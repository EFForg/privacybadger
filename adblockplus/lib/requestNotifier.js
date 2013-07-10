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
 * @fileOverview Stores Adblock Plus data to be attached to a window.
 */

Cu.import("resource://gre/modules/Services.jsm");

let {Utils} = require("utils");
let {BlockingFilter, WhitelistFilter, ElemHideBase, ElemHideFilter, ElemHideException} = require("filterClasses");

let nodeData = new WeakMap();
let windowStats = new WeakMap();
let windowSelection = new WeakMap();

let setEntry, hasEntry, getEntry;
if (false)
{
  // This branch can be enabled again once both bug 673468 and bug 819131 are
  // fixed and we can use weak maps
  setEntry = function(map, key, value) map.set(key, value);
  hasEntry = function(map, key) map.has(key);
  getEntry = function(map, key) map.get(key);
}
else
{
  // Fall back to user data
  let dataSeed = Math.random();
  let nodeDataProp = "abpNodeData" + dataSeed;
  let windowStatsProp = "abpWindowStats" + dataSeed;
  let windowSelectionProp = "abpWindowSelection" + dataSeed;
  let getProp = function(map)
  {
    switch (map)
    {
      case nodeData:
        return nodeDataProp;
      case windowStats:
        return windowStatsProp;
      case windowSelection:
        return windowSelectionProp;
      default:
        return null;
    }
  };

  setEntry = function(map, key, value) key.setUserData(getProp(map), value, null);
  hasEntry = function(map, key) key.getUserData(getProp(map));
  getEntry = function(map, key) key.getUserData(getProp(map)) || undefined;
}

/**
 * List of notifiers in use - these notifiers need to receive notifications on
 * new requests.
 * @type RequestNotifier[]
 */
let activeNotifiers = [];

/**
 * Creates a notifier object for a particular window. After creation the window
 * will first be scanned for previously saved requests. Once that scan is
 * complete only new requests for this window will be reported.
 * @param {Window} wnd  window to attach the notifier to
 * @param {Function} listener  listener to be called whenever a new request is found
 * @param {Object} [listenerObj]  "this" pointer to be used when calling the listener
 */
function RequestNotifier(wnd, listener, listenerObj)
{
  this.window = wnd;
  this.listener = listener;
  this.listenerObj = listenerObj || null;
  activeNotifiers.push(this);
  if (wnd)
    this.startScan(wnd);
  else
    this.scanComplete = true;
}
exports.RequestNotifier = RequestNotifier;

RequestNotifier.prototype =
{
  /**
   * The window this notifier is associated with.
   * @type Window
   */
  window: null,

  /**
   * The listener to be called when a new request is found.
   * @type Function
   */
  listener: null,

  /**
   * "this" pointer to be used when calling the listener.
   * @type Object
   */
  listenerObj: null,

  /**
   * Will be set to true once the initial window scan is complete.
   * @type Boolean
   */
  scanComplete: false,

  /**
   * Shuts down the notifier once it is no longer used. The listener
   * will no longer be called after that.
   */
  shutdown: function()
  {
    delete this.window;
    delete this.listener;
    delete this.listenerObj;

    for (let i = activeNotifiers.length - 1; i >= 0; i--)
      if (activeNotifiers[i] == this)
        activeNotifiers.splice(i, 1);
  },

  /**
   * Notifies listener about a new request.
   */
  notifyListener: function(/**Window*/ wnd, /**Node*/ node, /**RequestEntry*/ entry)
  {
    this.listener.call(this.listenerObj, wnd, node, entry, this.scanComplete);
  },

  /**
   * Number of currently posted scan events (will be 0 when the scan finishes
   * running).
   */
  eventsPosted: 0,

  /**
   * Starts the initial scan of the window (will recurse into frames).
   * @param {Window} wnd  the window to be scanned
   */
  startScan: function(wnd)
  {
    let currentThread = Utils.threadManager.currentThread;

    let doc = wnd.document;
    let walker = doc.createTreeWalker(doc, Ci.nsIDOMNodeFilter.SHOW_ELEMENT, null, false);

    let runnable =
    {
      notifier: null,

      run: function()
      {
        if (!this.notifier.listener)
          return;

        let node = walker.currentNode;
        let data = getEntry(nodeData, node);
        if (typeof data != "undefined")
          for (let k in data)
            this.notifier.notifyListener(wnd, node, data[k]);

        if (walker.nextNode())
          currentThread.dispatch(runnable, Ci.nsIEventTarget.DISPATCH_NORMAL);
        else
        {
          // Done with the current window, start the scan for its frames
          for (let i = 0; i < wnd.frames.length; i++)
            this.notifier.startScan(wnd.frames[i]);

          this.notifier.eventsPosted--;
          if (!this.notifier.eventsPosted)
          {
            this.notifier.scanComplete = true;
            this.notifier.notifyListener(wnd, null, null);
          }

          this.notifier = null;
        }
      }
    };
    runnable.notifier = this;

    // Process each node in a separate event on current thread to allow other
    // events to process
    this.eventsPosted++;
    currentThread.dispatch(runnable, Ci.nsIEventTarget.DISPATCH_NORMAL);
  }
};

RequestNotifier.storeSelection = function(/**Window*/ wnd, /**String*/ selection)
{
  setEntry(windowSelection, wnd.document, selection);
};
RequestNotifier.getSelection = function(/**Window*/ wnd) /**String*/
{
  if (hasEntry(windowSelection, wnd.document))
    return getEntry(windowSelection, wnd.document);
  else
    return null;
};

/**
 * Attaches request data to a DOM node.
 * @param {Node} node   node to attach data to
 * @param {Window} topWnd   top-level window the node belongs to
 * @param {Integer} contentType   request type, one of the Policy.type.* constants
 * @param {String} docDomain  domain of the document that initiated the request
 * @param {Boolean} thirdParty  will be true if a third-party server has been requested
 * @param {String} location   the address that has been requested
 * @param {Filter} filter   filter applied to the request or null if none
 */
RequestNotifier.addNodeData = function(/**Node*/ node, /**Window*/ topWnd, /**Integer*/ contentType, /**String*/ docDomain, /**Boolean*/ thirdParty, /**String*/ location, /**Filter*/ filter)
{
  return new RequestEntry(node, topWnd, contentType, docDomain, thirdParty, location, filter);
}

/**
 * Retrieves the statistics for a window.
 * @result {Object} Object with the properties items, blocked, whitelisted, hidden, filters containing statistics for the window (might be null)
 */
RequestNotifier.getWindowStatistics = function(/**Window*/ wnd)
{
  if (hasEntry(windowStats, wnd.document))
    return getEntry(windowStats, wnd.document);
  else
    return null;
}

/**
 * Retrieves the request entry associated with a DOM node.
 * @param {Node} node
 * @param {Boolean} noParent  if missing or false, the search will extend to the parent nodes until one is found that has data associated with it
 * @param {Integer} [type] request type to be looking for
 * @param {String} [location] request location to be looking for
 * @result {[Node, RequestEntry]}
 * @static
 */
RequestNotifier.getDataForNode = function(node, noParent, type, location)
{
  while (node)
  {
    let data = getEntry(nodeData, node);
    if (typeof data != "undefined")
    {
      // Look for matching entry
      for (let k in data)
      {
        let entry = data[k];
        if ((typeof type == "undefined" || entry.type == type) &&
            (typeof location == "undefined" || entry.location == location))
        {
          return [node, entry];
        }
      }
    }

    // If we don't have any match on this node then maybe its parent will do
    if ((typeof noParent != "boolean" || !noParent) &&
        node.parentNode instanceof Ci.nsIDOMElement)
    {
      node = node.parentNode;
    }
    else
    {
      node = null;
    }
  }

  return null;
};

function RequestEntry(node, topWnd, contentType, docDomain, thirdParty, location, filter)
{
  this.type = contentType;
  this.docDomain = docDomain;
  this.thirdParty = thirdParty;
  this.location = location;
  this.filter = filter;

  this.attachToNode(node);

  // Update window statistics
  if (!hasEntry(windowStats, topWnd.document))
  {
    setEntry(windowStats, topWnd.document, {
      items: 0,
      hidden: 0,
      blocked: 0,
      whitelisted: 0,
      filters: {}
    });
  }

  let stats = getEntry(windowStats, topWnd.document);
  if (!filter || !(filter instanceof ElemHideBase))
    stats.items++;
  if (filter)
  {
    if (filter instanceof BlockingFilter)
      stats.blocked++;
    else if (filter instanceof WhitelistFilter || filter instanceof ElemHideException)
      stats.whitelisted++;
    else if (filter instanceof ElemHideFilter)
      stats.hidden++;

    if (filter.text in stats.filters)
      stats.filters[filter.text]++;
    else
      stats.filters[filter.text] = 1;
  }

  // Notify listeners
  for each (let notifier in activeNotifiers)
    if (!notifier.window || notifier.window == topWnd)
      notifier.notifyListener(topWnd, node, this);
}
RequestEntry.prototype =
{
  /**
   * Content type of the request (one of the nsIContentPolicy constants)
   * @type Integer
   */
  type: null,
  /**
   * Domain name of the requesting document
   * @type String
   */
  docDomain: null,
  /**
   * True if the request goes to a different domain than the domain of the containing document
   * @type Boolean
   */
  thirdParty: false,
  /**
   * Address being requested
   * @type String
   */
  location: null,
  /**
   * Filter that was applied to this request (if any)
   * @type Filter
   */
  filter: null,
  /**
   * String representation of the content type, e.g. "subdocument"
   * @type String
   */
  get typeDescr() require("contentPolicy").Policy.typeDescr[this.type],
  /**
   * User-visible localized representation of the content type, e.g. "frame"
   * @type String
   */
  get localizedDescr() require("contentPolicy").Policy.localizedDescr[this.type],

  /**
   * Attaches this request object to a DOM node.
   */
  attachToNode: function(/**Node*/ node)
  {
    let existingData = getEntry(nodeData, node);
    if (typeof existingData == "undefined")
    {
      existingData = {};
      setEntry(nodeData, node, existingData);
    }

    // Add this request to the node data
    existingData[this.type + " " + this.location] = this;
  }
};
