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

//
// Report data template, more data will be added during data collection
//

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;

let contentWindow = window.arguments[0];
let windowURI = (window.arguments[1] instanceof Ci.nsIURI ? window.arguments[1] : null);

let reportData = new DOMParser().parseFromString("<report></report>", "text/xml");

// Some helper functions to work with the report data
function reportElement(tag)
{
  for (let child = reportData.documentElement.firstChild; child; child = child.nextSibling)
    if (child.nodeType == Node.ELEMENT_NODE && child.tagName == tag)
      return child;
  let element = reportData.createElement(tag);
  reportData.documentElement.appendChild(element);
  return element;
}
function removeReportElement(tag)
{
  for (let child = reportData.documentElement.firstChild; child; child = child.nextSibling)
    if (child.nodeType == Node.ELEMENT_NODE && child.tagName == tag)
      child.parentNode.removeChild(child);
}
function appendElement(parent, tag, attributes, body)
{
  let element = parent.ownerDocument.createElement(tag);
  if (typeof attributes == "object" && attributes !== null)
    for (let attribute in attributes)
      if (attributes.hasOwnProperty(attribute))
        element.setAttribute(attribute, attributes[attribute]);
  if (typeof body != "undefined" && body !== null)
    element.textContent = body;
  parent.appendChild(element);
  return element;
}
function serializeReportData()
{
  let result = new XMLSerializer().serializeToString(reportData);

  // Insert line breaks before each new tag
  result = result.replace(/(<[^\/]([^"<>]*|"[^"]*")*>)/g, "\n$1");
  result = result.replace(/^\n+/, "");
  return result;
}

let (element = reportElement("adblock-plus"))
{
  let {addonVersion} = require("info");
  element.setAttribute("version", addonVersion);
  element.setAttribute("locale", Utils.appLocale);
};
let (element = reportElement("application"))
{
  element.setAttribute("name", Services.appinfo.name);
  element.setAttribute("vendor", Services.appinfo.vendor);
  element.setAttribute("version", Services.appinfo.version);
  element.setAttribute("userAgent", window.navigator.userAgent);
};
let (element = reportElement("platform"))
{
  element.setAttribute("name", "Gecko");
  element.setAttribute("version", Services.appinfo.platformVersion);
  element.setAttribute("build", Services.appinfo.platformBuildID);
};
let (element = reportElement("options"))
{
  appendElement(element, "option", {id: "enabled"}, Prefs.enabled);
  appendElement(element, "option", {id: "objecttabs"}, Prefs.frameobjects);
  appendElement(element, "option", {id: "collapse"}, !Prefs.fastcollapse);
  appendElement(element, "option", {id: "privateBrowsing"}, PrivateBrowsing.enabledForWindow(contentWindow) || PrivateBrowsing.enabled);
  appendElement(element, "option", {id: "subscriptionsAutoUpdate"}, Prefs.subscriptions_autoupdate);
  appendElement(element, "option", {id: "javascript"}, Services.prefs.getBoolPref("javascript.enabled"));
  appendElement(element, "option", {id: "cookieBehavior"}, Services.prefs.getIntPref("network.cookie.cookieBehavior"));
};

//
// Data collectors
//

let reportsListDataSource =
{
  list: [],

  collectData: function(wnd, windowURI, callback)
  {
    let data = Prefs.recentReports;
    if (data && "length" in data)
    {
      for (let i = 0; i < data.length; i++)
      {
        let entry = data[i];
        if (typeof entry.reportURL == "string" && entry.reportURL &&
            typeof entry.time == "number" && Date.now() - entry.time < 30*24*60*60*1000)
        {
          let newEntry = {site: null, reportURL: entry.reportURL, time: entry.time};
          if (typeof entry.site == "string" && entry.site)
            newEntry.site = entry.site;
          this.list.push(newEntry);
        }
      }
    }

    if (this.list.length > 10)
      this.list.splice(10);

    E("recentReports").hidden = !this.list.length;
    if (this.list.length)
    {
      let rows = E("recentReportsRows")
      for (let i = 0; i < this.list.length; i++)
      {
        let entry = this.list[i];
        let row = document.createElement("row");

        let link = document.createElement("description");
        link.setAttribute("class", "text-link");
        link.setAttribute("url", entry.reportURL);
        link.textContent = entry.reportURL.replace(/^.*\/(?=[^\/])/, "");
        row.appendChild(link);

        let site = document.createElement("description");
        if (entry.site)
          site.textContent = entry.site;
        row.appendChild(site);

        let time = document.createElement("description");
        time.textContent = Utils.formatTime(entry.time);
        row.appendChild(time);

        rows.appendChild(row);
      }
    }

    callback();
  },

  addReport: function(site, reportURL)
  {
    this.list.unshift({site: site, reportURL: reportURL, time: Date.now()});
    Prefs.recentReports = this.list;
  },

  clear: function()
  {
    this.list = [];
    Prefs.recentReports = this.list;
    E("recentReports").hidden = true;
  },

  handleClick: function(event)
  {
    if (event.button != 0 || !event.target || !event.target.hasAttribute("url"))
      return;

    UI.loadInBrowser(event.target.getAttribute("url"));
  }
};

let requestsDataSource =
{
  requests: reportElement("requests"),
  origRequests: [],
  requestNotifier: null,
  callback: null,
  nodeByKey: {__proto__: null},

  collectData: function(wnd, windowURI, callback)
  {
    this.callback = callback;
    this.requestNotifier = new RequestNotifier(wnd, this.onRequestFound, this);
  },

  onRequestFound: function(frame, node, entry, scanComplete)
  {
    if (entry)
    {
      let key = entry.location + " " + entry.typeDescr + " " + entry.docDomain;
      let requestXML;
      if (key in this.nodeByKey)
      {
        requestXML = this.nodeByKey[key];
        requestXML.setAttribute("count", parseInt(requestXML.getAttribute("count"), 10) + 1);
      }
      else
      {
        requestXML = this.nodeByKey[key] = appendElement(this.requests, "request", {
          location: censorURL(entry.location),
          type: entry.typeDescr,
          docDomain: entry.docDomain,
          thirdParty: entry.thirdParty,
          count: 1
        });
      }

      // Location is meaningless for element hiding hits
      if (entry.filter && entry.filter instanceof ElemHideBase)
        requestXML.removeAttribute("location");

      if (entry.filter)
        requestXML.setAttribute("filter", entry.filter.text);

      if (node instanceof Element)
      {
        requestXML.setAttribute("node", (node.namespaceURI ? node.namespaceURI + "#" : "") + node.localName);

        try
        {
          requestXML.setAttribute("size", node.offsetWidth + "x" + node.offsetHeight);
        } catch(e) {}
      }
      this.origRequests.push(entry);
    }

    if (scanComplete)
    {
      this.requestNotifier.shutdown();
      this.requestNotifier = null;
      this.callback();
    }
  }
};

let filtersDataSource =
{
  origFilters: [],

  collectData: function(wnd, windowURI, callback)
  {
    let wndStats = RequestNotifier.getWindowStatistics(wnd);
    if (wndStats)
    {
      let filters = reportElement("filters");
      for (let f in wndStats.filters)
      {
        let filter = Filter.fromText(f)
        let hitCount = wndStats.filters[f];
        appendElement(filters, "filter", {
          text: filter.text,
          subscriptions: filter.subscriptions.filter(subscriptionsDataSource.subscriptionFilter).map(function(s) s.url).join(" "),
          hitCount: hitCount
        });
        this.origFilters.push(filter);
      }
    }
    callback();
  }
};

let subscriptionsDataSource =
{
  subscriptionFilter: function(s)
  {
    if (s.disabled || !(s instanceof RegularSubscription))
      return false;
    if (s instanceof DownloadableSubscription && !/^(http|https|ftp):/i.test(s.url))
      return false;
    return true;
  },

  collectData: function(wnd, windowURI, callback)
  {
    let subscriptions = reportElement("subscriptions");
    let now = Math.round(Date.now() / 1000);
    for (let i = 0; i < FilterStorage.subscriptions.length; i++)
    {
      let subscription = FilterStorage.subscriptions[i];
      if (!this.subscriptionFilter(subscription))
        continue;

      let subscriptionXML = appendElement(subscriptions, "subscription", {
        id: subscription.url,
        disabledFilters: subscription.filters.filter(function(filter) filter instanceof ActiveFilter && filter.disabled).length
      });
      if (subscription.lastDownload)
        subscriptionXML.setAttribute("lastDownloadAttempt", subscription.lastDownload - now);
      if (subscription instanceof DownloadableSubscription)
      {
        if (subscription.lastSuccess)
          subscriptionXML.setAttribute("lastDownloadSuccess", subscription.lastSuccess - now);
        if (subscription.softExpiration)
          subscriptionXML.setAttribute("softExpiration", subscription.softExpiration - now);
        if (subscription.expires)
          subscriptionXML.setAttribute("hardExpiration", subscription.expires - now);
        subscriptionXML.setAttribute("downloadStatus", subscription.downloadStatus);
      }
    }
    callback();
  }
};

let screenshotDataSource =
{
  imageOffset: 10,

  // Fields used for color reduction
  _mapping: [0x00,  0x55,  0xAA,  0xFF],
  _i: null,
  _max: null,
  _pixelData: null,
  _callback: null,

  // Fields used for user interaction
  _enabled: true,
  _canvas: null,
  _context: null,
  _selectionType: "mark",
  _currentData: null,
  _undoQueue: [],

  collectData: function(wnd, windowURI, callback)
  {
    this._callback = callback;
    this._canvas = E("screenshotCanvas");
    this._canvas.width = this._canvas.offsetWidth;

    // Do not resize canvas any more (no idea why Gecko requires both to be set)
    this._canvas.parentNode.style.MozBoxAlign = "center";
    this._canvas.parentNode.align = "center";

    this._context = this._canvas.getContext("2d");
    let wndWidth = wnd.document.documentElement.scrollWidth;
    let wndHeight = wnd.document.documentElement.scrollHeight;

    // Copy scaled screenshot of the webpage. We scale the webpage by width
    // but leave 10px on each side for easier selecting.

    // Gecko doesn't like sizes more than 64k, restrict to 30k to be on the safe side.
    // Also, make sure height is at most five times the width to keep image size down.
    let copyWidth = Math.min(wndWidth, 30000);
    let copyHeight = Math.min(wndHeight, 30000, copyWidth * 5);
    let copyX = Math.max(Math.min(wnd.scrollX - copyWidth / 2, wndWidth - copyWidth), 0);
    let copyY = Math.max(Math.min(wnd.scrollY - copyHeight / 2, wndHeight - copyHeight), 0);

    let scalingFactor = (this._canvas.width - this.imageOffset * 2) / copyWidth;
    this._canvas.height = copyHeight * scalingFactor + this.imageOffset * 2;

    this._context.save();
    this._context.translate(this.imageOffset, this.imageOffset);
    this._context.scale(scalingFactor, scalingFactor);
    this._context.drawWindow(wnd, copyX, copyY, copyWidth, copyHeight, "rgb(255,255,255)");
    this._context.restore();

    // Init canvas settings
    this._context.fillStyle = "rgb(0, 0, 0)";
    this._context.strokeStyle = "rgba(255, 0, 0, 0.7)";
    this._context.lineWidth = 3;
    this._context.lineJoin = "round";

    // Reduce colors asynchronously
    this._pixelData = this._context.getImageData(this.imageOffset, this.imageOffset,
                                      this._canvas.width - this.imageOffset * 2,
                                      this._canvas.height - this.imageOffset * 2);
    this._max = this._pixelData.width * this._pixelData.height * 4;
    this._i = 0;
    Utils.threadManager.currentThread.dispatch(this, Ci.nsIEventTarget.DISPATCH_NORMAL);
  },

  run: function()
  {
    // Process only 5000 bytes at a time to prevent browser hangs
    let endIndex = Math.min(this._i + 5000, this._max);
    let i = this._i;
    for (; i < endIndex; i++)
      this._pixelData.data[i] = this._mapping[this._pixelData.data[i] >> 6];

    if (i >= this._max)
    {
      // Save data back and we are done
      this._context.putImageData(this._pixelData, this.imageOffset, this.imageOffset);
      this._callback();
    }
    else
    {
      this._i = i;
      Utils.threadManager.currentThread.dispatch(this, Ci.nsIEventTarget.DISPATCH_NORMAL);
    }
  },

  get enabled() this._enabled,
  set enabled(enabled)
  {
    if (this._enabled == enabled)
      return;

    this._enabled = enabled;
    this._canvas.style.opacity = this._enabled ? "" : "0.3"
    E("screenshotMarkButton").disabled = !this._enabled;
    E("screenshotRemoveButton").disabled = !this._enabled;
    E("screenshotUndoButton").disabled = !this._enabled || !this._undoQueue.length;
  },

  get selectionType() this._selectionType,
  set selectionType(type)
  {
    if (this._selectionType == type)
      return;

    // Abort selection already in progress
    this.abortSelection();

    this._selectionType = type;
  },

  exportData: function()
  {
    removeReportElement("screenshot");
    if (this.enabled)
    {
      appendElement(reportData.documentElement, "screenshot", {
        edited: (this._undoQueue.length ? 'true' : 'false')
      }, this._canvas.toDataURL());
    }
  },

  abortSelection: function()
  {
    if (this._currentData && this._currentData.data)
    {
      this._context.putImageData(this._currentData.data,
        Math.min(this._currentData.anchorX, this._currentData.currentX),
        Math.min(this._currentData.anchorY, this._currentData.currentY));
    }
    document.removeEventListener("keypress", this.handleKeyPress, true);
    this._currentData = null;
  },

  handleKeyPress: function(event)
  {
    if (event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_ESCAPE)
    {
      event.stopPropagation();
      event.preventDefault();
      screenshotDataSource.abortSelection();
    }
  },

  startSelection: function(event)
  {
    if (event.button == 2)
      this.abortSelection();   // Right mouse button aborts selection

    if (event.button != 0 || !this.enabled)
      return;

    // Abort selection already in progress
    this.abortSelection();

    let boxObject = document.getBoxObjectFor(this._canvas);
    let [x, y] = [event.screenX - boxObject.screenX, event.screenY - boxObject.screenY];
    this._currentData = {
      data: null,
      anchorX: x,
      anchorY: y,
      currentX: -1,
      currentY: -1
    };
    this.updateSelection(event);

    document.addEventListener("keypress", this.handleKeyPress, true);
  },

  updateSelection: function(event)
  {
    if (event.button != 0 || !this._currentData)
      return;

    let boxObject = document.getBoxObjectFor(this._canvas);
    let [x, y] = [event.screenX - boxObject.screenX, event.screenY - boxObject.screenY];
    if (this._currentData.currentX == x && this._currentData.currentY == y)
      return;

    if (this._currentData.data)
    {
      this._context.putImageData(this._currentData.data,
        Math.min(this._currentData.anchorX, this._currentData.currentX),
        Math.min(this._currentData.anchorY, this._currentData.currentY));
    }

    this._currentData.currentX = x;
    this._currentData.currentY = y;

    let left = Math.min(this._currentData.anchorX, this._currentData.currentX);
    let right = Math.max(this._currentData.anchorX, this._currentData.currentX);
    let top = Math.min(this._currentData.anchorY, this._currentData.currentY);
    let bottom = Math.max(this._currentData.anchorY, this._currentData.currentY);

    let minDiff = (this._selectionType == "mark" ? 3 : 1);
    if (right - left >= minDiff && bottom - top >= minDiff)
      this._currentData.data = this._context.getImageData(left, top, right - left, bottom - top);
    else
      this._currentData.data = null;

    if (this._selectionType == "mark")
    {
      // all coordinates need to be moved 1.5px inwards to get the desired result
      left += 1.5;
      right -= 1.5;
      top += 1.5;
      bottom -= 1.5;
      if (left < right && top < bottom)
        this._context.strokeRect(left, top, right - left, bottom - top);
    }
    else if (this._selectionType == "remove")
      this._context.fillRect(left, top, right - left, bottom - top);
  },

  stopSelection: function(event)
  {
    if (event.button != 0 || !this._currentData)
      return;

    if (this._currentData.data)
    {
      this._undoQueue.push(this._currentData);
      E("screenshotUndoButton").disabled = false;
    }

    this._currentData = null;
    document.removeEventListener("keypress", this.handleKeyPress, true);
  },

  undo: function()
  {
    let op = this._undoQueue.pop();
    if (!op)
      return;

    this._context.putImageData(op.data,
      Math.min(op.anchorX, op.currentX),
      Math.min(op.anchorY, op.currentY));

    if (!this._undoQueue.length)
      E("screenshotUndoButton").disabled = true;
  }
};

let framesDataSource =
{
  site: null,

  collectData: function(wnd, windowURI, callback)
  {
    try
    {
      this.site = windowURI.host;
      if (this.site)
        document.title += " (" + this.site + ")";
    }
    catch (e)
    {
      // Expected exception - not all URL schemes have a host name
    }

    let window = reportElement("window");
    window.setAttribute("url", censorURL(windowURI ? windowURI.spec : wnd.location.href));
    if (wnd.opener && wnd.opener.location.href)
      window.setAttribute("opener", censorURL(wnd.opener.location.href));
    if (wnd.document.referrer)
      window.setAttribute("referrer", censorURL(wnd.document.referrer));
    this.scanFrames(wnd, window);

    callback();
  },

  scanFrames: function(wnd, xmlList)
  {
    try
    {
      for (let i = 0; i < wnd.frames.length; i++)
      {
        let frame = wnd.frames[i];
        let frameXML = appendElement(xmlList, "frame", {
          url: censorURL(frame.location.href)
        });
        this.scanFrames(frame, frameXML);
      }
    }
    catch (e)
    {
      // Don't break if something goes wrong
      Cu.reportError(e);
    }
  }
};

let errorsDataSource =
{
  collectData: function(wnd, windowURI, callback)
  {
    let {addonID} = require("info");
    addonID = addonID.replace(/[\{\}]/g, "");

    // See https://bugzilla.mozilla.org/show_bug.cgi?id=664695 - starting with
    // Gecko 19 this function returns the result, before that it wrote to a
    // parameter.
    let outparam = {};
    let messages = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).getMessageArray(outparam, {});
    messages = messages || outparam.value || [];
    messages = messages.filter(function(message)
    {
      return (message instanceof Ci.nsIScriptError &&
          !/^https?:/i.test(message.sourceName) &&
          (/adblock/i.test(message.errorMessage) || /adblock/i.test(message.sourceName) ||
           message.errorMessage.indexOf(addonID) >= 0 || message.sourceName.indexOf(addonID) >= 0));
    });
    if (messages.length > 10)   // Only the last 10 messages
      messages = messages.slice(messages.length - 10, messages.length);

    // Censor app and profile paths in error messages
    let censored = {__proto__: null};
    let pathList = [["ProfD", "%PROFILE%"], ["GreD", "%GRE%"], ["CurProcD", "%APP%"]];
    for (let i = 0; i < pathList.length; i++)
    {
      let [pathID, placeholder] = pathList[i];
      try
      {
        let file = FileUtils.getDir(pathID, [], false);
        censored[file.path.replace(/[\\\/]+$/, '')] = placeholder;
        let uri = Utils.ioService.newFileURI(file);
        censored[uri.spec.replace(/[\\\/]+$/, '')] = placeholder;
      } catch(e) {}
    }

    let errors = reportElement("errors");
    for (let i = 0; i < messages.length; i++)
    {
      let message = messages[i];

      let text = message.errorMessage;
      for (let path in censored)
        text = text.replace(path, censored[path], "gi");
      if (text.length > 256)
        text = text.substr(0, 256) + "...";

      let file = message.sourceName;
      for (let path in censored)
        file = file.replace(path, censored[path], "gi");
      if (file.length > 256)
        file = file.substr(0, 256) + "...";

      let sourceLine = message.sourceLine;
      if (sourceLine.length > 256)
        sourceLine = sourceLine.substr(0, 256) + "...";

      appendElement(errors, "error", {
        type: message.flags & Ci.nsIScriptError.warningFlag ? "warning" : "error",
        text: text,
        file: file,
        line: message.lineNumber,
        column: message.columnNumber,
        sourceLine: sourceLine
      });
    }

    callback();
  }
};

let extensionsDataSource =
{
  data: reportData.createElement("extensions"),

  collectData: function(wnd, windowURI, callback)
  {
    try
    {
      let AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm", null).AddonManager;
      AddonManager.getAddonsByTypes(["extension", "plugin"], function(items)
      {
        for (let i = 0; i < items.length; i++)
        {
          let item = items[i];
          if (!item.isActive)
            continue;
          appendElement(this.data, "extension", {
            id: item.id,
            name: item.name,
            type: item.type,
            version: item.version
          });
        }
        callback();
      }.bind(this));
    }
    catch (e)
    {
      // No add-on manager, what's going on? Skip this step.
      callback();
    }
  },

  exportData: function(doExport)
  {
    if (doExport)
      reportData.documentElement.appendChild(this.data);
    else if (this.data.parentNode)
      this.data.parentNode.removeChild(this.data);
  }
};

let subscriptionUpdateDataSource =
{
  contentWnd: null,
  type: null,
  outdated: null,
  needUpdate: null,

  collectData: function(wnd, windowURI, callback)
  {
    this.contentWnd = wnd;
    let now = Date.now() / MILLISECONDS_IN_SECOND;
    let outdatedThreshold = now - 14 * SECONDS_IN_DAY;
    let needUpdateThreshold = now - 1 * SECONDS_IN_HOUR;

    this.outdated = [];
    this.needUpdate = [];

    let subscriptions = FilterStorage.subscriptions.filter(issuesDataSource.subscriptionFilter);
    for (let i = 0; i < subscriptions.length; i++)
    {
      let lastSuccess = subscriptions[i].lastSuccess;
      if (lastSuccess < outdatedThreshold)
        this.outdated.push(subscriptions[i]);
      if (lastSuccess < needUpdateThreshold)
        this.needUpdate.push(subscriptions[i]);
    }

    callback();
  },

  updatePage: function(type)
  {
    this.type = type;
    E("updateInProgress").hidden = (type != "false positive" || this.needUpdate.length == 0);
    E("outdatedSubscriptions").hidden = !E("updateInProgress").hidden || this.outdated.length == 0;
    if (!E("outdatedSubscriptions").hidden)
    {
      let template = E("outdatedSubscriptionTemplate");
      let list = E("outdatedSubscriptionsList");
      while (list.lastChild)
        list.removeChild(list.lastChild);

      for (let i = 0; i < this.outdated.length; i++)
      {
        let subscription = this.outdated[i];
        let entry = template.cloneNode(true);
        entry.removeAttribute("id");
        entry.removeAttribute("hidden");
        entry.setAttribute("_url", subscription.url);
        entry.setAttribute("tooltiptext", subscription.url);
        entry.textContent = subscription.title;
        list.appendChild(entry);
      }
    }
    return !E("updateInProgress").hidden || !E("outdatedSubscriptions").hidden;
  },

  showPage: function()
  {
    document.documentElement.canAdvance = false;

    if (!E("updateInProgress").hidden)
    {
      document.documentElement.canRewind = false;

      for (let i = 0; i < this.needUpdate.length; i++)
        Synchronizer.execute(this.needUpdate[i], true, true);

      let listener = function(action)
      {
        if (!/^subscription\./.test(action))
          return;

        for (let i = 0; i < this.needUpdate.length; i++)
          if (Synchronizer.isExecuting(this.needUpdate[i].url))
            return;

        FilterNotifier.removeListener(listener);
        E("updateInProgress").hidden = "true";

        let filtersRemoved = false;
        let requests = requestsDataSource.origRequests;
        for (let i = 0; i < requests.length; i++)
          if (requests[i].filter && !requests[i].filter.subscriptions.filter(function(s) !s.disabled).length)
            filtersRemoved = true;

        if (filtersRemoved)
        {
          // Force the user to reload the page
          E("updateFixedIssue").hidden = false;
          document.documentElement.canAdvance = true;

          let nextButton = document.documentElement.getButton("next");
          [nextButton.label, nextButton.accessKey] = Utils.splitLabel(E("updatePage").getAttribute("reloadButtonLabel"));
          document.documentElement.addEventListener("wizardnext", function(event)
          {
            event.preventDefault();
            event.stopPropagation();
            window.close();
            this.contentWnd.location.reload();
          }.bind(this), true);
        }
        else
        {
          this.collectData(null, null, function() {});
          this.needUpdate = [];
          if (this.outdated.length)
          {
            document.documentElement.canRewind = true;

            this.updatePage(this.type);
            this.showPage();
          }
          else
          {
            // No more issues, make sure to remove this page from history and
            // advance to the next page.
            document.documentElement.canRewind = true;
            document.documentElement.canAdvance = true;

            let next = document.documentElement.currentPage.next;
            document.documentElement.rewind();
            document.documentElement.currentPage.next = next;

            document.documentElement.advance();
          }
        }
      }.bind(this);

      FilterNotifier.addListener(listener);
      window.addEventListener("unload", function()
      {
        FilterNotifier.removeListener(listener);
      });
    }
  },

  updateOutdated: function()
  {
    for (let i = 0; i < this.outdated.length; i++)
      Synchronizer.execute(this.outdated[i], true, true);
  }
}

let issuesDataSource =
{
  contentWnd: null,
  isEnabled: Prefs.enabled,
  whitelistFilter: null,
  disabledFilters: [],
  disabledSubscriptions: [],
  ownFilters: [],
  numSubscriptions: 0,
  numAppliedFilters: Infinity,

  subscriptionFilter: function(s)
  {
    if (s instanceof DownloadableSubscription)
      return subscriptionsDataSource.subscriptionFilter(s);
    else
      return false;
  },

  collectData: function(wnd, windowURI, callback)
  {
    this.contentWnd = wnd;
    this.whitelistFilter = Policy.isWindowWhitelisted(wnd);

    if (!this.whitelistFilter && this.isEnabled)
    {
      // Find disabled filters in active subscriptions matching any of the requests
      let disabledMatcher = new CombinedMatcher();
      for each (let subscription in FilterStorage.subscriptions)
      {
        if (subscription.disabled)
          continue;

        for each (let filter in subscription.filters)
          if (filter instanceof BlockingFilter && filter.disabled)
            disabledMatcher.add(filter);
      }

      let seenFilters = {__proto__: null};
      for each (let request in requestsDataSource.origRequests)
      {
        if (request.filter)
          continue;

        let filter = disabledMatcher.matchesAny(request.location, request.typeDescr, request.docDomain, request.thirdParty);
        if (filter && !(filter.text in seenFilters))
        {
          this.disabledFilters.push(filter);
          seenFilters[filter.text] = true;
        }
      }

      // Find disabled subscriptions with filters matching any of the requests
      let seenSubscriptions = {__proto__: null};
      for each (let subscription in FilterStorage.subscriptions)
      {
        if (!subscription.disabled)
          continue;

        disabledMatcher.clear();
        for each (let filter in subscription.filters)
          if (filter instanceof BlockingFilter)
            disabledMatcher.add(filter);

        for each (let request in requestsDataSource.origRequests)
        {
          if (request.filter)
            continue;

          let filter = disabledMatcher.matchesAny(request.location, request.typeDescr, request.docDomain, request.thirdParty);
          if (filter && !(subscription.url in seenSubscriptions))
          {
            this.disabledSubscriptions.push(subscription);
            seenSubscriptions[subscription.text] = true;
            break;
          }
        }
      }

      this.numSubscriptions = FilterStorage.subscriptions.filter(this.subscriptionFilter).length;
      this.numAppliedFilters = 0;
      for each (let filter in filtersDataSource.origFilters)
      {
        if (filter instanceof WhitelistFilter)
          continue;

        this.numAppliedFilters++;
        if (filter.subscriptions.some(function(subscription) subscription instanceof SpecialSubscription))
          this.ownFilters.push(filter);
      }
    }

    callback();
  },

  updateIssues: function(type)
  {
    if (type == "other")
    {
      E("typeSelectorPage").next = "typeWarning";
      return;
    }

    E("issuesWhitelistBox").hidden = !this.whitelistFilter;
    E("issuesDisabledBox").hidden = this.isEnabled;
    E("issuesNoFiltersBox").hidden = (type != "false positive" || this.numAppliedFilters > 0);
    E("issuesNoSubscriptionsBox").hidden = (type != "false negative" || this.numAppliedFilters > 0 || this.numSubscriptions > 0);
    E("issuesSubscriptionCountBox").hidden = (this.numSubscriptions < 5);

    let ownFiltersBox = E("issuesOwnFilters");
    if (this.ownFilters.length && !ownFiltersBox.firstChild)
    {
      let template = E("issuesOwnFiltersTemplate");
      for each (let filter in this.ownFilters)
      {
        let element = template.cloneNode(true);
        element.removeAttribute("id");
        element.removeAttribute("hidden");
        element.firstChild.setAttribute("value", filter.text);
        element.firstChild.setAttribute("tooltiptext", filter.text);
        element.abpFilter = filter;
        ownFiltersBox.appendChild(element);
      }
    }
    E("issuesOwnFiltersBox").hidden = (type != "false positive" || this.ownFilters.length == 0);

    let disabledSubscriptionsBox = E("issuesDisabledSubscriptions");
    if (this.disabledSubscriptions.length && !disabledSubscriptionsBox.firstChild)
    {
      let template = E("issuesDisabledSubscriptionsTemplate");
      for each (let subscription in this.disabledSubscriptions)
      {
        let element = template.cloneNode(true);
        element.removeAttribute("id");
        element.removeAttribute("hidden");
        element.firstChild.setAttribute("value", subscription.title);
        element.setAttribute("tooltiptext", subscription instanceof DownloadableSubscription ? subscription.url : subscription.title);
        element.abpSubscription = subscription;
        disabledSubscriptionsBox.appendChild(element);
      }
    }
    E("issuesDisabledSubscriptionsBox").hidden = (type != "false negative" || this.disabledSubscriptions.length == 0);

    let disabledFiltersBox = E("issuesDisabledFilters");
    if (this.disabledFilters.length && !disabledFiltersBox.firstChild)
    {
      let template = E("issuesDisabledFiltersTemplate");
      for each (let filter in this.disabledFilters)
      {
        let element = template.cloneNode(true);
        element.removeAttribute("id");
        element.removeAttribute("hidden");
        element.firstChild.setAttribute("value", filter.text);
        element.setAttribute("tooltiptext", filter.text);
        element.abpFilter = filter;
        disabledFiltersBox.appendChild(element);
      }
    }
    E("issuesDisabledFiltersBox").hidden = (type != "false negative" || this.disabledFilters.length == 0);

    // Don't allow sending report if the page is whitelisted - we need the data.
    // Also disallow reports without matching filters or without subscriptions,
    // subscription authors cannot do anything about those.
    E("issuesOverride").hidden = !E("issuesWhitelistBox").hidden ||
                                 !E("issuesDisabledBox").hidden ||
                                 !E("issuesNoFiltersBox").hidden ||
                                 !E("issuesNoSubscriptionsBox").hidden ||
                                 !E("issuesSubscriptionCountBox").hidden;

    let page = E("typeSelectorPage");
    if (subscriptionUpdateDataSource.updatePage(type))
    {
      page.next = "update";
      page = E("updatePage");
    }

    if (E("issuesWhitelistBox").hidden && E("issuesDisabledBox").hidden &&
        E("issuesNoFiltersBox").hidden && E("issuesNoSubscriptionsBox").hidden &&
        E("issuesOwnFiltersBox").hidden && E("issuesDisabledFiltersBox").hidden &&
        E("issuesDisabledSubscriptionsBox").hidden && E("issuesSubscriptionCountBox").hidden)
    {
      page.next = "screenshot";
    }
    else
    {
      page.next = "issues";
    }
  },

  forceReload: function()
  {
    // User changed configuration, don't allow sending report now - page needs
    // to be reloaded
    E("issuesOverride").hidden = true;
    E("issuesChangeMessage").hidden = false;
    document.documentElement.canRewind = false;
    document.documentElement.canAdvance = true;

    let contentWnd = this.contentWnd;
    let nextButton = document.documentElement.getButton("next");
    [nextButton.label, nextButton.accessKey] = Utils.splitLabel(E("updatePage").getAttribute("reloadButtonLabel"));
    document.documentElement.addEventListener("wizardnext", function(event)
    {
      event.preventDefault();
      event.stopPropagation();
      window.close();
      contentWnd.location.reload();
    }, true);
  },

  removeWhitelist: function()
  {
    if (this.whitelistFilter && this.whitelistFilter.subscriptions.length)
      this.whitelistFilter.disabled = true;
    E("issuesWhitelistBox").hidden = true;
    this.forceReload();
  },

  enable: function()
  {
    Prefs.enabled = true;
    E("issuesDisabledBox").hidden = true;
    this.forceReload();
  },

  addSubscription: function()
  {
    let result = {};
    openDialog("subscriptionSelection.xul", "_blank", "chrome,centerscreen,modal,resizable,dialog=no", null, result);
    if (!("url" in result))
      return;

    let subscriptionResults = [[result.url, result.title]];
    if ("mainSubscriptionURL" in result)
      subscriptionResults.push([result.mainSubscriptionURL, result.mainSubscriptionTitle]);

    for each (let [url, title] in subscriptionResults)
    {
      let subscription = Subscription.fromURL(url);
      if (!subscription)
        continue;

      FilterStorage.addSubscription(subscription);

      subscription.disabled = false;
      subscription.title = title;

      if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
        Synchronizer.execute(subscription);
    }

    E("issuesNoSubscriptionsBox").hidden = true;
    this.forceReload();
  },

  disableFilter: function(node)
  {
    let filter = node.abpFilter;
    if (filter && filter.subscriptions.length)
      filter.disabled = true;

    node.parentNode.removeChild(node);
    if (!E("issuesOwnFilters").firstChild)
      E("issuesOwnFiltersBox").hidden = true;
    this.forceReload();
  },

  enableFilter: function(node)
  {
    let filter = node.abpFilter;
    if (filter && filter.subscriptions.length)
      filter.disabled = false;

    node.parentNode.removeChild(node);
    if (!E("issuesDisabledFilters").firstChild)
      E("issuesDisabledFiltersBox").hidden = true;
    this.forceReload();
  },


  enableSubscription: function(node)
  {
    let subscription = node.abpSubscription;
    if (subscription)
      subscription.disabled = false;

    node.parentNode.removeChild(node);
    if (!E("issuesDisabledSubscriptions").firstChild)
      E("issuesDisabledSubscriptionsBox").hidden = true;
    this.forceReload();
  }
};

let dataCollectors = [reportsListDataSource, requestsDataSource, filtersDataSource, subscriptionsDataSource,
                      screenshotDataSource, framesDataSource, errorsDataSource, extensionsDataSource,
                      subscriptionUpdateDataSource, issuesDataSource];

//
// Wizard logic
//

function initWizard()
{
  // Make sure no issue type is selected by default
  E("typeGroup").selectedItem = null;
  document.documentElement.addEventListener("pageshow", updateNextButton, false);

  // Move wizard header
  let header = document.getAnonymousElementByAttribute(document.documentElement, "class", "wizard-header");
  if (header)
  {
    document.getElementById("wizardHeaderLabel").setAttribute("value", document.documentElement.wizardPages[0].getAttribute("label"));
    document.documentElement.insertBefore(document.getElementById("wizardHeader"), document.documentElement.firstChild);
    document.documentElement.addEventListener("pageshow", function()
    {
      document.getElementById("wizardHeaderDeck").selectedIndex = (document.documentElement.pageIndex == 0 ? 0 : 1);
    }, false);
  }

  // Move privacy link
  let extraButton = document.documentElement.getButton("extra1");
  extraButton.parentNode.insertBefore(E("privacyLink"), extraButton);
}

function updateNextButton()
{
  let nextButton = document.documentElement.getButton("next");
  if (!nextButton)
    return;

  if (document.documentElement.currentPage.id == "commentPage")
  {
    if (!("_origLabel" in nextButton))
    {
      nextButton._origLabel = nextButton.label;
      nextButton._origAccessKey = nextButton.accessKey;
      [nextButton.label, nextButton.accessKey] = Utils.splitLabel(document.documentElement.getAttribute("sendbuttonlabel"));
    }
  }
  else
  {
    if ("_origLabel" in nextButton)
    {
      nextButton.label = nextButton._origLabel;
      nextButton.accessKey = nextButton._origAccessKey;
      delete nextButton._origLabel;
      delete nextButton._origAccessKey;
    }
  }
}

function initDataCollectorPage()
{
  document.documentElement.canAdvance = false;

  let totalSteps = dataCollectors.length;
  let initNextDataSource = function()
  {
    if (!dataCollectors.length)
    {
      // We are done, continue to next page
      document.documentElement.canAdvance = true;
      document.documentElement.advance();
      return;
    }

    let progress = (totalSteps - dataCollectors.length) / totalSteps * 100;
    if (progress > 0)
    {
      let progressMeter = E("dataCollectorProgress");
      progressMeter.mode = "determined";
      progressMeter.value = progress;
    }

    // Continue with the next data source, asynchronously to allow progress meter to update
    let dataSource = dataCollectors.shift();
    Utils.runAsync(function()
    {
      dataSource.collectData(contentWindow, windowURI, initNextDataSource);
    });
  };

  initNextDataSource();
}

function initTypeSelectorPage()
{
  E("progressBar").activeItem = E("typeSelectorHeader");
  let header = document.getAnonymousElementByAttribute(document.documentElement, "class", "wizard-header");
  if (header)
    header.setAttribute("viewIndex", "1");

  document.documentElement.canRewind = false;
  typeSelectionUpdated();
}

function typeSelectionUpdated()
{
  let selection = E("typeGroup").selectedItem;
  document.documentElement.canAdvance = (selection != null);
  if (selection)
  {
    if (reportData.documentElement.getAttribute("type") != selection.value)
    {
      E("screenshotCheckbox").checked = (selection.value != "other");
      E("screenshotCheckbox").doCommand();
      E("extensionsCheckbox").checked = (selection.value == "other");
      E("extensionsCheckbox").doCommand();
    }
    reportData.documentElement.setAttribute("type", selection.value);

    issuesDataSource.updateIssues(selection.value);
  }
}

function initIssuesPage()
{
  updateIssuesOverride();
}

function updateIssuesOverride()
{
  document.documentElement.canAdvance = E("issuesOverride").checked;
}

function initTypeWarningPage()
{
  updateTypeWarningOverride();

  let textElement = E("typeWarningText");
  if ("abpInitialized" in textElement)
    return;

  let template = textElement.textContent.replace(/[\r\n\s]+/g, " ");

  let [, beforeLink, linkText, afterLink] = /(.*)\[link\](.*)\[\/link\](.*)/.exec(template) || [null, "", template, ""];
  while (textElement.firstChild && textElement.firstChild.nodeType != Node.ELEMENT_NODE)
    textElement.removeChild(textElement.firstChild);
  while (textElement.lastChild && textElement.lastChild.nodeType != Node.ELEMENT_NODE)
    textElement.removeChild(textElement.lastChild);

  if (textElement.firstChild)
    textElement.firstChild.textContent = linkText;
  textElement.insertBefore(document.createTextNode(beforeLink), textElement.firstChild);
  textElement.appendChild(document.createTextNode(afterLink));
  textElement.abpInitialized = true;
}

function updateTypeWarningOverride()
{
  document.documentElement.canAdvance = E("typeWarningOverride").checked;
}

function initScreenshotPage()
{
  document.documentElement.canAdvance = true;

  E("progressBar").activeItem = E("screenshotHeader");
}

function initCommentPage()
{
  E("progressBar").activeItem = E("commentPageHeader");

  updateEmail();

  screenshotDataSource.exportData();
  updateDataField();
}

function showDataField()
{
  E('dataDeck').selectedIndex = 1;
  updateDataField();
  E('data').focus();
}

let _dataFieldUpdateTimeout = null;

function _updateDataField()
{
  let dataField = E("data");
  let [selectionStart, selectionEnd] = [dataField.selectionStart, dataField.selectionEnd];
  dataField.value = serializeReportData();
  dataField.setSelectionRange(selectionStart, selectionEnd);
}

function updateDataField()
{
  // Don't do anything if data field is hidden
  if (E('dataDeck').selectedIndex != 1)
    return;

  if (_dataFieldUpdateTimeout)
  {
    window.clearTimeout(_dataFieldUpdateTimeout);
    _dataFieldUpdateTimeout = null;
  }

  _dataFieldUpdateTimeout = window.setTimeout(_updateDataField, 200);
}

function updateComment()
{
  removeReportElement("comment");

  let value = E("comment").value;
  appendElement(reportData.documentElement, "comment", null, value.substr(0, 1000));
  E("commentLengthWarning").setAttribute("visible", value.length > 1000);
  updateDataField();
}

function updateEmail()
{
  removeReportElement("email");

  let anonymous = E("anonymousCheckbox").checked;

  let value = E("email").value;

  // required for persist to work on textbox, see: https://bugzilla.mozilla.org/show_bug.cgi?id=111486
  E("email").setAttribute("value", value);

  E("email").disabled = anonymous;
  E("emailLabel").disabled = anonymous;
  E("anonymityWarning").setAttribute("visible", anonymous);

  if (!anonymous)
    appendElement(reportData.documentElement, "email", null, value);

  updateDataField();

  document.documentElement.canAdvance = anonymous || /\S/.test(value);
}

function updateExtensions(attach)
{
  extensionsDataSource.exportData(attach);
  updateDataField();
}

function initSendPage()
{
  E("progressBar").activeItem = E("sendPageHeader");

  E("result").hidden = true;
  E("sendReportErrorBox").hidden = true;
  E("sendReportMessage").hidden = false;
  E("sendReportProgress").hidden = false;
  E("sendReportProgress").mode = "undetermined";

  document.documentElement.canRewind = false;
  document.documentElement.getButton("finish").disabled = true;

  let guid = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator).generateUUID().toString().replace(/[\{\}]/g, "");
  let url = Prefs.report_submiturl.replace(/%GUID%/g, guid).replace(/%LANG%/g, Utils.appLocale);
  let request = new XMLHttpRequest();
  request.open("POST", url);
  request.setRequestHeader("Content-Type", "text/xml");
  request.setRequestHeader("X-Adblock-Plus", "1");
  request.addEventListener("load", reportSent, false);
  request.addEventListener("error", reportSent, false);
  if ("upload" in request && request.upload)
    request.upload.addEventListener("progress", updateReportProgress, false);
  request.send(serializeReportData());
}

function updateReportProgress(event)
{
  if (!event.lengthComputable)
    return;

  let progress = Math.round(event.loaded / event.total * 100);
  if (progress > 0)
  {
    let progressMeter = E("sendReportProgress");
    progressMeter.mode = "determined";
    progressMeter.value = progress;
  }
}

function reportSent(event)
{
  let request = event.target;
  let success = false;
  let errorMessage = E("sendReportError").getAttribute("defaultError");
  try
  {
    let status = request.channel.status;
    if (Components.isSuccessCode(status))
    {
      success = (request.status == 200 || request.status == 0);
      errorMessage = request.status + " " + request.statusText;
    }
    else
    {
      errorMessage = "0x" + status.toString(16);

      // Try to find the name for the status code
      let exception = Cc["@mozilla.org/js/xpc/Exception;1"].createInstance(Ci.nsIXPCException);
      exception.initialize(null, status, null, null, null, null);
      if (exception.name)
        errorMessage = exception.name;
    }
  } catch (e) {}

  let result = "";
  try
  {
    result = request.responseText;
  } catch (e) {}

  result = result.replace(/%CONFIRMATION%/g, encodeHTML(E("result").getAttribute("confirmationMessage")));
  result = result.replace(/%KNOWNISSUE%/g, encodeHTML(E("result").getAttribute("knownIssueMessage")));
  result = result.replace(/(<html)\b/, '$1 dir="' + window.getComputedStyle(document.documentElement, "").direction + '"');

  if (!success)
  {
    let errorElement = E("sendReportError");
    let template = errorElement.getAttribute("textTemplate").replace(/[\r\n\s]+/g, " ");

    let [, beforeLink, linkText, afterLink] = /(.*)\[link\](.*)\[\/link\](.*)/.exec(template) || [null, "", template, ""];
    beforeLink = beforeLink.replace(/\?1\?/g, errorMessage);
    afterLink = afterLink.replace(/\?1\?/g, errorMessage);

    while (errorElement.firstChild && errorElement.firstChild.nodeType != Node.ELEMENT_NODE)
      errorElement.removeChild(errorElement.firstChild);
    while (errorElement.lastChild && errorElement.lastChild.nodeType != Node.ELEMENT_NODE)
      errorElement.removeChild(errorElement.lastChild);

    if (errorElement.firstChild)
      errorElement.firstChild.textContent = linkText;
    errorElement.insertBefore(document.createTextNode(beforeLink), errorElement.firstChild);
    errorElement.appendChild(document.createTextNode(afterLink));

    E("sendReportErrorBox").hidden = false;
  }

  E("sendReportProgress").hidden = true;

  let frame = E("result");
  frame.hidden = false;
  frame.docShell.allowAuth = false;
  frame.docShell.allowJavascript = false;
  frame.docShell.allowMetaRedirects = false;
  frame.docShell.allowPlugins = false;
  frame.docShell.allowSubframes = false;

  frame.setAttribute("src", "data:text/html;charset=utf-8," + encodeURIComponent(result));

  E("sendReportMessage").hidden = true;

  if (success)
  {
    try
    {
      let link = request.responseXML.getElementById("link").getAttribute("href");
      let button = E("copyLink");
      button.setAttribute("url", link);
      button.removeAttribute("disabled");

      if (!PrivateBrowsing.enabledForWindow(contentWindow) && !PrivateBrowsing.enabled)
        reportsListDataSource.addReport(framesDataSource.site, link);
    } catch (e) {}
    E("copyLinkBox").hidden = false;

    document.documentElement.getButton("finish").disabled = false;
    document.documentElement.getButton("cancel").disabled = true;
    E("progressBar").activeItemComplete = true;
  }
}

function processLinkClick(event)
{
  event.preventDefault();

  let link = event.target;
  while (link && !(link instanceof HTMLAnchorElement))
    link = link.parentNode;

  if (link && (link.protocol == "http:" || link.protocol == "https:"))
    UI.loadInBrowser(link.href);
}

function copyLink(url)
{
  Utils.clipboardHelper.copyString(url);
}

function censorURL(url)
{
  return url.replace(/([?;&\/#][^?;&\/#]+?=)[^?;&\/#]+/g, "$1*");
}

function encodeHTML(str)
{
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
