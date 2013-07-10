/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @fileOverview Content policy implementation, responsible for blocking things.
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let {TimeLine} = require("timeline");
let {Utils} = require("utils");
let {Prefs} = require("prefs");
let {FilterStorage} = require("filterStorage");
let {BlockingFilter, WhitelistFilter} = require("filterClasses");
let {defaultMatcher} = require("matcher");
let {objectMouseEventHander} = require("objectTabs");
let {RequestNotifier} = require("requestNotifier");
let {ElemHide} = require("elemHide");

/**
 * List of explicitly supported content types
 * @type Array of String
 */
let contentTypes = ["OTHER", "SCRIPT", "IMAGE", "STYLESHEET", "OBJECT", "SUBDOCUMENT", "DOCUMENT", "XMLHTTPREQUEST", "OBJECT_SUBREQUEST", "FONT", "MEDIA"];

/**
 * List of content types that aren't associated with a visual document area
 * @type Array of String
 */
let nonVisualTypes = ["SCRIPT", "STYLESHEET", "XMLHTTPREQUEST", "OBJECT_SUBREQUEST", "FONT"];

/**
 * Randomly generated class name, to be applied to collapsed nodes.
 */
let collapsedClass = "";

/**
 * Public policy checking functions and auxiliary objects
 * @class
 */
let Policy = exports.Policy =
{
  /**
   * Map of content type identifiers by their name.
   * @type Object
   */
  type: {},

  /**
   * Map of content type names by their identifiers (reverse of type map).
   * @type Object
   */
  typeDescr: {},

  /**
   * Map of localized content type names by their identifiers.
   * @type Object
   */
  localizedDescr: {},

  /**
   * Lists the non-visual content types.
   * @type Object
   */
  nonVisual: {},

  /**
   * Map containing all schemes that should be ignored by content policy.
   * @type Object
   */
  whitelistSchemes: {},

  /**
   * Called on module startup, initializes various exported properties.
   */
  init: function()
  {
    TimeLine.enter("Entered content policy initialization");

    // type constant by type description and type description by type constant
    let iface = Ci.nsIContentPolicy;
    for each (let typeName in contentTypes)
    {
      if ("TYPE_" + typeName in iface)
      {
        let id = iface["TYPE_" + typeName];
        this.type[typeName] = id;
        this.typeDescr[id] = typeName;
        this.localizedDescr[id] = Utils.getString("type_label_" + typeName.toLowerCase());
      }
    }

    this.type.ELEMHIDE = 0xFFFD;
    this.typeDescr[0xFFFD] = "ELEMHIDE";
    this.localizedDescr[0xFFFD] = Utils.getString("type_label_elemhide");

    this.type.POPUP = 0xFFFE;
    this.typeDescr[0xFFFE] = "POPUP";
    this.localizedDescr[0xFFFE] = Utils.getString("type_label_popup");

    for each (let type in nonVisualTypes)
      this.nonVisual[this.type[type]] = true;

    // whitelisted URL schemes
    for each (let scheme in Prefs.whitelistschemes.toLowerCase().split(" "))
      this.whitelistSchemes[scheme] = true;

    TimeLine.log("done initializing types");

    // Generate class identifier used to collapse node and register corresponding
    // stylesheet.
    TimeLine.log("registering global stylesheet");

    let offset = "a".charCodeAt(0);
    for (let i = 0; i < 20; i++)
      collapsedClass +=  String.fromCharCode(offset + Math.random() * 26);

    let collapseStyle = Services.io.newURI("data:text/css," +
        encodeURIComponent("." + collapsedClass +
        "{-moz-binding: url(chrome://global/content/bindings/general.xml#foobarbazdummy) !important;}"), null, null);
    Utils.styleService.loadAndRegisterSheet(collapseStyle, Ci.nsIStyleSheetService.USER_SHEET);
    onShutdown.add(function()
    {
      Utils.styleService.unregisterSheet(collapseStyle, Ci.nsIStyleSheetService.USER_SHEET);
    })
    TimeLine.log("done registering stylesheet");

    TimeLine.leave("Done initializing content policy");
  },

  /**
   * Checks whether a node should be blocked, hides it if necessary
   * @param wnd {nsIDOMWindow}
   * @param node {nsIDOMElement}
   * @param contentType {String}
   * @param location {nsIURI}
   * @param collapse {Boolean} true to force hiding of the node
   * @return {Boolean} false if the node should be blocked
   */
  processNode: function(wnd, node, contentType, location, collapse)
  {
    let topWnd = wnd.top;
    if (!topWnd || !topWnd.location || !topWnd.location.href)
      return true;

    let originWindow = Utils.getOriginWindow(wnd);
    let wndLocation = originWindow.location.href;
    let docDomain = getHostname(wndLocation);
    let match = null;
    if (!match && Prefs.enabled)
    {
      let testWnd = wnd;
      let parentWndLocation = getWindowLocation(testWnd);
      while (true)
      {
        let testWndLocation = parentWndLocation;
        parentWndLocation = (testWnd == testWnd.parent ? testWndLocation : getWindowLocation(testWnd.parent));
        match = Policy.isWhitelisted(testWndLocation, parentWndLocation);

        if (!(match instanceof WhitelistFilter))
        {
          let keydata = (testWnd.document && testWnd.document.documentElement ? testWnd.document.documentElement.getAttribute("data-adblockkey") : null);
          if (keydata && keydata.indexOf("_") >= 0)
          {
            let [key, signature] = keydata.split("_", 2);
            let keyMatch = defaultMatcher.matchesByKey(testWndLocation, key.replace(/=/g, ""), docDomain);
            if (keyMatch && Utils.crypto)
            {
              // Website specifies a key that we know but is the signature valid?
              let uri = Services.io.newURI(testWndLocation, null, null);
              let params = [
                uri.path.replace(/#.*/, ""),  // REQUEST_URI
                uri.asciiHost,                // HTTP_HOST
                Utils.httpProtocol.userAgent  // HTTP_USER_AGENT
              ];
              if (Utils.verifySignature(key, signature, params.join("\0")))
                match = keyMatch;
            }
          }
        }

        if (match instanceof WhitelistFilter)
        {
          FilterStorage.increaseHitCount(match, wnd);
          RequestNotifier.addNodeData(testWnd.document, topWnd, Policy.type.DOCUMENT, getHostname(parentWndLocation), false, testWndLocation, match);
          return true;
        }

        if (testWnd.parent == testWnd)
          break;
        else
          testWnd = testWnd.parent;
      }
    }

    // Data loaded by plugins should be attached to the document
    if (contentType == Policy.type.OBJECT_SUBREQUEST && node instanceof Ci.nsIDOMElement)
      node = node.ownerDocument;

    // Fix type for objects misrepresented as frames or images
    if (contentType != Policy.type.OBJECT && (node instanceof Ci.nsIDOMHTMLObjectElement || node instanceof Ci.nsIDOMHTMLEmbedElement))
      contentType = Policy.type.OBJECT;

    let locationText = location.spec;
    if (!match && contentType == Policy.type.ELEMHIDE)
    {
      let testWnd = wnd;
      let parentWndLocation = getWindowLocation(testWnd);
      while (true)
      {
        let testWndLocation = parentWndLocation;
        parentWndLocation = (testWnd == testWnd.parent ? testWndLocation : getWindowLocation(testWnd.parent));
        let parentDocDomain = getHostname(parentWndLocation);
        match = defaultMatcher.matchesAny(testWndLocation, "ELEMHIDE", parentDocDomain, false);
        if (match instanceof WhitelistFilter)
        {
          FilterStorage.increaseHitCount(match, wnd);
          RequestNotifier.addNodeData(testWnd.document, topWnd, contentType, parentDocDomain, false, testWndLocation, match);
          return true;
        }

        if (testWnd.parent == testWnd)
          break;
        else
          testWnd = testWnd.parent;
      }

      match = location;
      locationText = match.text.replace(/^.*?#/, '#');
      location = locationText;

      if (!match.isActiveOnDomain(docDomain))
        return true;

      let exception = ElemHide.getException(match, docDomain);
      if (exception)
      {
        FilterStorage.increaseHitCount(exception, wnd);
        RequestNotifier.addNodeData(node, topWnd, contentType, docDomain, thirdParty, locationText, exception);
        return true;
      }
    }

    let thirdParty = (contentType == Policy.type.ELEMHIDE ? false : isThirdParty(location, docDomain));

    if (!match && Prefs.enabled)
    {
      match = defaultMatcher.matchesAny(locationText, Policy.typeDescr[contentType] || "", docDomain, thirdParty);
      if (match instanceof BlockingFilter && node.ownerDocument && !(contentType in Policy.nonVisual))
      {
        let prefCollapse = (match.collapse != null ? match.collapse : !Prefs.fastcollapse);
        if (collapse || prefCollapse)
          schedulePostProcess(node);
      }

      // Track mouse events for objects
      if (!match && contentType == Policy.type.OBJECT && node.nodeType == Ci.nsIDOMNode.ELEMENT_NODE)
      {
        node.addEventListener("mouseover", objectMouseEventHander, true);
        node.addEventListener("mouseout", objectMouseEventHander, true);
      }
    }

    // Store node data
    RequestNotifier.addNodeData(node, topWnd, contentType, docDomain, thirdParty, locationText, match);
    if (match)
      FilterStorage.increaseHitCount(match, wnd);

    return !match || match instanceof WhitelistFilter;
  },

  /**
   * Checks whether the location's scheme is blockable.
   * @param location  {nsIURI}
   * @return {Boolean}
   */
  isBlockableScheme: function(location)
  {
    return !(location.scheme in Policy.whitelistSchemes);
  },

  /**
   * Checks whether a page is whitelisted.
   * @param {String} url
   * @param {String} [parentUrl] location of the parent page
   * @return {Filter} filter that matched the URL or null if not whitelisted
   */
  isWhitelisted: function(url, parentUrl)
  {
    if (!url)
      return null;

    // Do not apply exception rules to schemes on our whitelistschemes list.
    let match = /^([\w\-]+):/.exec(url);
    if (match && match[1] in Policy.whitelistSchemes)
      return null;

    if (!parentUrl)
      parentUrl = url;

    // Ignore fragment identifier
    let index = url.indexOf("#");
    if (index >= 0)
      url = url.substring(0, index);

    let result = defaultMatcher.matchesAny(url, "DOCUMENT", getHostname(parentUrl), false);
    return (result instanceof WhitelistFilter ? result : null);
  },

  /**
   * Checks whether the page loaded in a window is whitelisted.
   * @param wnd {nsIDOMWindow}
   * @return {Filter} matching exception rule or null if not whitelisted
   */
  isWindowWhitelisted: function(wnd)
  {
    return Policy.isWhitelisted(getWindowLocation(wnd));
  },


  /**
   * Asynchronously re-checks filters for given nodes.
   */
  refilterNodes: function(/**Node[]*/ nodes, /**RequestEntry*/ entry)
  {
    // Ignore nodes that have been blocked already
    if (entry.filter && !(entry.filter instanceof WhitelistFilter))
      return;

    for each (let node in nodes)
      Utils.runAsync(refilterNode, this, node, entry);
  }
};
Policy.init();

/**
 * Actual nsIContentPolicy and nsIChannelEventSink implementation
 * @class
 */
let PolicyImplementation =
{
  classDescription: "Adblock Plus content policy",
  classID: Components.ID("cfeaabe6-1dd1-11b2-a0c6-cb5c268894c9"),
  contractID: "@adblockplus.org/abp/policy;1",
  xpcom_categories: ["content-policy", "net-channel-event-sinks"],

  /**
   * Registers the content policy on startup.
   */
  init: function()
  {
    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.registerFactory(this.classID, this.classDescription, this.contractID, this);

    let catMan = Utils.categoryManager;
    for each (let category in this.xpcom_categories)
      catMan.addCategoryEntry(category, this.contractID, this.contractID, false, true);

    Services.obs.addObserver(this, "http-on-modify-request", true);
    Services.obs.addObserver(this, "content-document-global-created", true);
    Services.obs.addObserver(this, "xpcom-category-entry-removed", true);
    Services.obs.addObserver(this, "xpcom-category-cleared", true);

    onShutdown.add(function()
    {
      // Our category observers should be removed before changing category
      // memberships, just in case.
      Services.obs.removeObserver(this, "http-on-modify-request");
      Services.obs.removeObserver(this, "content-document-global-created");
      Services.obs.removeObserver(this, "xpcom-category-entry-removed");
      Services.obs.removeObserver(this, "xpcom-category-cleared");

      for each (let category in this.xpcom_categories)
        catMan.deleteCategoryEntry(category, this.contractID, false);

      // This needs to run asynchronously, see bug 753687
      Utils.runAsync(function()
      {
        registrar.unregisterFactory(this.classID, this);
      }.bind(this));

      this.previousRequest = null;
    }.bind(this));
  },

  //
  // nsISupports interface implementation
  //

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIObserver,
    Ci.nsIChannelEventSink, Ci.nsIFactory, Ci.nsISupportsWeakReference]),

  //
  // nsIContentPolicy interface implementation
  //

  shouldLoad: function(contentType, contentLocation, requestOrigin, node, mimeTypeGuess, extra)
  {
    // Ignore requests without context and top-level documents
    if (!node || contentType == Policy.type.DOCUMENT)
      return Ci.nsIContentPolicy.ACCEPT;

    // Ignore standalone objects
    if (contentType == Policy.type.OBJECT && node.ownerDocument && !/^text\/|[+\/]xml$/.test(node.ownerDocument.contentType))
      return Ci.nsIContentPolicy.ACCEPT;

    let wnd = Utils.getWindow(node);
    if (!wnd)
      return Ci.nsIContentPolicy.ACCEPT;

    // Ignore whitelisted schemes
    let location = Utils.unwrapURL(contentLocation);
    if (!Policy.isBlockableScheme(location))
      return Ci.nsIContentPolicy.ACCEPT;

    // Interpret unknown types as "other"
    if (!(contentType in Policy.typeDescr))
      contentType = Policy.type.OTHER;

    let result = Policy.processNode(wnd, node, contentType, location, false);
    if (result)
    {
      // We didn't block this request so we will probably see it again in
      // http-on-modify-request. Keep it so that we can associate it with the
      // channel there - will be needed in case of redirect.
      this.previousRequest = [location, contentType];
    }
    return (result ? Ci.nsIContentPolicy.ACCEPT : Ci.nsIContentPolicy.REJECT_REQUEST);
  },

  shouldProcess: function(contentType, contentLocation, requestOrigin, insecNode, mimeType, extra)
  {
    return Ci.nsIContentPolicy.ACCEPT;
  },

  //
  // nsIObserver interface implementation
  //
  observe: function(subject, topic, data, additional)
  {
    switch (topic)
    {
      case "content-document-global-created":
      {
        if (!(subject instanceof Ci.nsIDOMWindow) || !subject.opener)
          return;

        let uri = additional || Utils.makeURI(subject.location.href);
        if (!Policy.processNode(subject.opener, subject.opener.document, Policy.type.POPUP, uri, false))
        {
          subject.stop();
          Utils.runAsync(subject.close, subject);
        }
        else if (uri.spec == "about:blank")
        {
          // An about:blank pop-up most likely means that a load will be
          // initiated synchronously. Set a flag for our "http-on-modify-request"
          // handler.
          this.expectingPopupLoad = true;
          Utils.runAsync(function()
          {
            this.expectingPopupLoad = false;
          });
        }
        break;
      }
      case "http-on-modify-request":
      {
        if (!(subject instanceof Ci.nsIHttpChannel))
          return;

        if (this.previousRequest && subject.URI == this.previousRequest[0] &&
            subject instanceof Ci.nsIWritablePropertyBag)
        {
          // We just handled a content policy call for this request - associate
          // the data with the channel so that we can find it in case of a redirect.
          subject.setProperty("abpRequestType", this.previousRequest[1]);
          this.previousRequest = null;
        }

        if (this.expectingPopupLoad)
        {
          let wnd = Utils.getRequestWindow(subject);
          if (wnd && wnd.opener && wnd.location.href == "about:blank")
            this.observe(wnd, "content-document-global-created", null, subject.URI);
        }

        break;
      }
      case "xpcom-category-entry-removed":
      case "xpcom-category-cleared":
      {
        let category = data;
        if (this.xpcom_categories.indexOf(category) < 0)
          return;

        if (topic == "xpcom-category-entry-removed" &&
            subject instanceof Ci.nsISupportsCString &&
            subject.data != this.contractID)
        {
          return;
        }

        // Our category entry was removed, make sure to add it back
        let catMan = Utils.categoryManager;
        catMan.addCategoryEntry(category, this.contractID, this.contractID, false, true);
        break;
      }
    }
  },

  //
  // nsIChannelEventSink interface implementation
  //

  asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback)
  {
    let result = Cr.NS_OK;
    try
    {
      // Try to retrieve previously stored request data from the channel
      let contentType;
      if (oldChannel instanceof Ci.nsIWritablePropertyBag)
      {
        try
        {
          contentType = oldChannel.getProperty("abpRequestType");
        }
        catch(e)
        {
          // No data attached, ignore this redirect
          return;
        }
      }

      let newLocation = null;
      try
      {
        newLocation = newChannel.URI;
      } catch(e2) {}
      if (!newLocation)
        return;

      let wnd = Utils.getRequestWindow(newChannel);
      if (!wnd)
        return;

      if (contentType == Policy.type.SUBDOCUMENT && wnd.parent == wnd.top && wnd.opener)
      {
        // This is a window opened in a new tab miscategorized as frame load,
        // see bug 467514. Get the frame as context to be at least consistent.
        wnd = wnd.opener;
      }

      if (!Policy.processNode(wnd, wnd.document, contentType, newLocation, false))
        result = Cr.NS_BINDING_ABORTED;
    }
    catch (e)
    {
      // We shouldn't throw exceptions here - this will prevent the redirect.
      Cu.reportError(e);
    }
    finally
    {
      callback.onRedirectVerifyCallback(result);
    }
  },

  //
  // nsIFactory interface implementation
  //

  createInstance: function(outer, iid)
  {
    if (outer)
      throw Cr.NS_ERROR_NO_AGGREGATION;
    return this.QueryInterface(iid);
  }
};
PolicyImplementation.init();

/**
 * Nodes scheduled for post-processing (might be null).
 * @type Array of Node
 */
let scheduledNodes = null;

/**
 * Schedules a node for post-processing.
 */
function schedulePostProcess(/**Element*/ node)
{
  if (scheduledNodes)
    scheduledNodes.push(node);
  else
  {
    scheduledNodes = [node];
    Utils.runAsync(postProcessNodes);
  }
}

/**
 * Processes nodes scheduled for post-processing (typically hides them).
 */
function postProcessNodes()
{
  let nodes = scheduledNodes;
  scheduledNodes = null;

  for each (let node in nodes)
  {
    // adjust frameset's cols/rows for frames
    let parentNode = node.parentNode;
    if (parentNode && parentNode instanceof Ci.nsIDOMHTMLFrameSetElement)
    {
      let hasCols = (parentNode.cols && parentNode.cols.indexOf(",") > 0);
      let hasRows = (parentNode.rows && parentNode.rows.indexOf(",") > 0);
      if ((hasCols || hasRows) && !(hasCols && hasRows))
      {
        let index = -1;
        for (let frame = node; frame; frame = frame.previousSibling)
          if (frame instanceof Ci.nsIDOMHTMLFrameElement || frame instanceof Ci.nsIDOMHTMLFrameSetElement)
            index++;

        let property = (hasCols ? "cols" : "rows");
        let weights = parentNode[property].split(",");
        weights[index] = "0";
        parentNode[property] = weights.join(",");
      }
    }
    else
      node.classList.add(collapsedClass);
  }
}

/**
 * Extracts the hostname from a URL (might return null).
 */
function getHostname(/**String*/ url) /**String*/
{
  try
  {
    return Utils.unwrapURL(url).host;
  }
  catch(e)
  {
    return null;
  }
}

/**
 * Retrieves the location of a window.
 * @param wnd {nsIDOMWindow}
 * @return {String} window location or null on failure
 */
function getWindowLocation(wnd)
{
  if ("name" in wnd && wnd.name == "messagepane")
  {
    // Thunderbird branch
    try
    {
      let mailWnd = wnd.QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIWebNavigation)
                       .QueryInterface(Ci.nsIDocShellTreeItem)
                       .rootTreeItem
                       .QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIDOMWindow);

      // Typically we get a wrapped mail window here, need to unwrap
      try
      {
        mailWnd = mailWnd.wrappedJSObject;
      } catch(e) {}

      if ("currentHeaderData" in mailWnd && "content-base" in mailWnd.currentHeaderData)
      {
        return mailWnd.currentHeaderData["content-base"].headerValue;
      }
      else if ("currentHeaderData" in mailWnd && "from" in mailWnd.currentHeaderData)
      {
        let emailAddress = Utils.headerParser.extractHeaderAddressMailboxes(mailWnd.currentHeaderData.from.headerValue);
        if (emailAddress)
          return 'mailto:' + emailAddress.replace(/^[\s"]+/, "").replace(/[\s"]+$/, "").replace(/\s/g, '%20');
      }
    } catch(e) {}
  }

  // Firefox branch
  return wnd.location.href;
}

/**
 * Checks whether the location's origin is different from document's origin.
 */
function isThirdParty(/**nsIURI*/location, /**String*/ docDomain) /**Boolean*/
{
  if (!location || !docDomain)
    return true;

  try
  {
    return Utils.effectiveTLD.getBaseDomain(location) != Utils.effectiveTLD.getBaseDomainFromHost(docDomain);
  }
  catch (e)
  {
    // EffectiveTLDService throws on IP addresses, just compare the host name
    let host = "";
    try
    {
      host = location.host;
    } catch (e) {}
    return host != docDomain;
  }
}

/**
 * Re-checks filters on an element.
 */
function refilterNode(/**Node*/ node, /**RequestEntry*/ entry)
{
  let wnd = Utils.getWindow(node);
  if (!wnd || wnd.closed)
    return;

  if (entry.type == Policy.type.OBJECT)
  {
    node.removeEventListener("mouseover", objectMouseEventHander, true);
    node.removeEventListener("mouseout", objectMouseEventHander, true);
  }
  Policy.processNode(wnd, node, entry.type, Utils.makeURI(entry.location), true);
}
