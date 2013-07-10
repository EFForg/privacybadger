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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Main browser window
var mainWin = parent;

// The window handler currently in use
var requestNotifier = null;

var cacheSession = null;
var noFlash = false;

// Matcher for disabled filters
var disabledMatcher = new CombinedMatcher();

// Cached string values
var docDomainThirdParty = null;
var docDomainFirstParty = null;

function init() {
  docDomainThirdParty = document.documentElement.getAttribute("docDomainThirdParty");
  docDomainFirstParty = document.documentElement.getAttribute("docDomainFirstParty");

  var list = E("list");
  list.view = treeView;

  // Restore previous state
  var params = Utils.getParams();
  if (params && params.filter)
  {
    E("searchField").value = params.filter;
    treeView.setFilter(params.filter);
  }
  if (params && params.focus && E(params.focus))
    E(params.focus).focus();
  else
    E("searchField").focus();

  var selected = null;
  if (/sidebarDetached\.xul$/.test(parent.location.href))
  {
    mainWin = parent.opener;
    mainWin.addEventListener("unload", mainUnload, false);
    E("detachButton").hidden = true;
    E("reattachButton").hidden = false;

    let mustDetach = parent.arguments[0];
    if (mustDetach)
      E("reattachButton").setAttribute("disabled", "true");
    if ("sidebar" in UI.hotkeys)
    {
      let {KeySelector} = require("keySelector");
      parent.addEventListener("keypress", function(event)
      {
        if (KeySelector.matchesKey(event, UI.hotkeys.sidebar))
          doClose();
      }, false);
    }

    // Set default size/position unless already persisted
    let defaults = {screenX: 0, screenY: 0, width: 600, height: 300};
    if (params && params.position)
      defaults = params.position;

    let wnd = parent.document.documentElement;
    for (let attr in defaults)
      if (!wnd.hasAttribute(attr))
        wnd.setAttribute(attr, defaults[attr]);
  }

  let {getBrowser, addBrowserLocationListener} = require("appSupport");
  window.__defineGetter__("content", function() {return getBrowser(mainWin).contentWindow;});

  // Initialize matcher for disabled filters
  reloadDisabledFilters();
  FilterNotifier.addListener(reloadDisabledFilters);
  Prefs.addListener(onPrefChange);

  // Activate flasher
  list.addEventListener("select", onSelectionChange, false);

  // Initialize data
  handleLocationChange();

  // Install a progress listener to catch location changes
  if (addBrowserLocationListener)
    addBrowserLocationListener(mainWin, handleLocationChange, true);
}

// To be called for a detached window when the main window has been closed
function mainUnload() {
  parent.close();
}

// To be called on unload
function cleanUp() {
  flasher.stop();
  requestNotifier.shutdown();
  FilterNotifier.removeListener(reloadDisabledFilters);
  Prefs.removeListener(onPrefChange);
  E("list").view = null;

  let {removeBrowserLocationListener} = require("appSupport");
  if (removeBrowserLocationListener)
    removeBrowserLocationListener(mainWin, handleLocationChange);
  mainWin.removeEventListener("unload", mainUnload, false);
}

/**
 * Tracks preference changes, calls reloadDisabledFilters whenever Adblock Plus
 * is enabled/disabled.
 */
function onPrefChange(name)
{
  if (name == "enabled")
    reloadDisabledFilters();
}

let reloadDisabledScheduled = false;

/**
 * Updates matcher for disabled filters (global disabledMatcher variable),
 * called on each filter change. Execute delayed to prevent multiple subsequent
 * invocations.
 */
function reloadDisabledFilters()
{
  if (reloadDisabledScheduled)
    return;

  Utils.runAsync(reloadDisabledFiltersInternal);
  reloadDisabledScheduled = true;
}

function reloadDisabledFiltersInternal()
{
  reloadDisabledScheduled = false;
  disabledMatcher.clear();

  if (Prefs.enabled)
  {
    for each (let subscription in FilterStorage.subscriptions)
    {
      if (subscription.disabled)
        continue;

      for each (let filter in subscription.filters)
        if (filter instanceof RegExpFilter && filter.disabled)
          disabledMatcher.add(filter);
    }
  }

  treeView.updateFilters();
}

// Called whenever list selection changes - triggers flasher
function onSelectionChange() {
  var item = treeView.getSelectedItem();
  if (item)
    E("copy-command").removeAttribute("disabled");
  else
    E("copy-command").setAttribute("disabled", "true");

  if (item && window.content)
  {
    let key = item.location + " " + item.type + " " + item.docDomain;
    RequestNotifier.storeSelection(window.content, key);
    treeView.itemToSelect = null;
  }

  if (!noFlash)
    flasher.flash(item ? item.nodes : null);
}

function handleLocationChange()
{
  if (requestNotifier)
    requestNotifier.shutdown();

  treeView.clearData();
  treeView.itemToSelect = RequestNotifier.getSelection(window.content);
  requestNotifier = new RequestNotifier(window.content, function(wnd, node, item, scanComplete)
  {
    if (item)
      treeView.addItem(node, item, scanComplete);
  });
}

// Fills a box with text splitting it up into multiple lines if necessary
function setMultilineContent(box, text, noRemove)
{
  if (!noRemove)
    while (box.firstChild)
      box.removeChild(box.firstChild);

  for (var i = 0; i < text.length; i += 80)
  {
    var description = document.createElement("description");
    description.setAttribute("value", text.substr(i, 80));
    box.appendChild(description);
  }
}

// Fill in tooltip data before showing it
function fillInTooltip(e) {
  // Prevent tooltip from overlapping menu
  if (E("context").state == "open")
  {
    e.preventDefault();
    return;
  }

  var item;
  if (treeView.data && !treeView.data.length)
    item = treeView.getDummyTooltip();
  else
    item = treeView.getItemAt(e.clientX, e.clientY);

  if (!item)
  {
    e.preventDefault();
    return;
  }

  let filter = ("filter" in item && item.filter ? item.filter : null);
  let size = ("tooltip" in item ? null : getItemSize(item));
  let subscriptions = (filter ? filter.subscriptions.filter(function(subscription) { return !subscription.disabled; }) : []);

  E("tooltipDummy").hidden = !("tooltip" in item);
  E("tooltipAddressRow").hidden = ("tooltip" in item);
  E("tooltipTypeRow").hidden = ("tooltip" in item);
  E("tooltipSizeRow").hidden = !size;
  E("tooltipDocDomainRow").hidden = ("tooltip" in item || !item.docDomain);
  E("tooltipFilterRow").hidden = !filter;
  E("tooltipFilterSourceRow").hidden = !subscriptions.length;

  if ("tooltip" in item)
    E("tooltipDummy").setAttribute("value", item.tooltip);
  else
  {
    E("tooltipAddress").parentNode.hidden = (item.typeDescr == "ELEMHIDE");
    setMultilineContent(E("tooltipAddress"), item.location);

    var type = item.localizedDescr;
    if (filter && filter instanceof WhitelistFilter)
      type += " " + E("tooltipType").getAttribute("whitelisted");
    else if (filter && item.typeDescr != "ELEMHIDE")
      type += " " + E("tooltipType").getAttribute("filtered");
    E("tooltipType").setAttribute("value", type);

    if (size)
      E("tooltipSize").setAttribute("value", size.join(" x "));

    E("tooltipDocDomain").setAttribute("value", item.docDomain + " " + (item.thirdParty ? docDomainThirdParty : docDomainFirstParty));
  }

  if (filter)
  {
    let filterField = E("tooltipFilter");
    setMultilineContent(filterField, filter.text);
    if (filter.disabled)
    {
      let disabledText = document.createElement("description");
      disabledText.className = "disabledTextLabel";
      disabledText.textContent = filterField.getAttribute("disabledText");
      filterField.appendChild(disabledText);
    }

    if (subscriptions.length)
    {
      let sourceElement = E("tooltipFilterSource");
      while (sourceElement.firstChild)
        sourceElement.removeChild(sourceElement.firstChild);
      for (let i = 0; i < subscriptions.length; i++)
        setMultilineContent(sourceElement, subscriptions[i].title, true);
    }
  }

  var showPreview = Prefs.previewimages && !("tooltip" in item);
  showPreview = showPreview && item.typeDescr == "IMAGE";
  showPreview = showPreview && (!item.filter || item.filter.disabled || item.filter instanceof WhitelistFilter);
  if (showPreview) {
    // Check whether image is in cache (stolen from ImgLikeOpera)
    if (!cacheSession) {
      var cacheService = Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService);
      cacheSession = cacheService.createSession("HTTP", Ci.nsICache.STORE_ANYWHERE, true);
    }

    try {
      var descriptor = cacheSession.openCacheEntry(item.location, Ci.nsICache.ACCESS_READ, false);
      descriptor.close();
    }
    catch (e) {
      showPreview = false;
    }
  }

  if (showPreview) {
    E("tooltipPreviewBox").hidden = false;
    E("tooltipPreview").setAttribute("src", "");
    E("tooltipPreview").setAttribute("src", item.location);
  }
  else
    E("tooltipPreviewBox").hidden = true;
}

const visual = {
  OTHER: true,
  IMAGE: true,
  SUBDOCUMENT: true
}

/**
 * Updates context menu before it is shown.
 */
function fillInContext(/**Event*/ e)
{
  let item, allItems;
  if (treeView.data && !treeView.data.length)
  {
    item = treeView.getDummyTooltip();
    allItems = [item];
  }
  else
  {
    item = treeView.getItemAt(e.clientX, e.clientY);
    allItems = treeView.getAllSelectedItems();
  }

  if (!item || ("tooltip" in item && !("filter" in item)))
    return false;

  E("contextDisableFilter").hidden = true;
  E("contextEnableFilter").hidden = true;
  E("contextDisableOnSite").hidden = true;
  if ("filter" in item && item.filter)
  {
    let filter = item.filter;
    let menuItem = E(filter.disabled ? "contextEnableFilter" : "contextDisableFilter");
    menuItem.setAttribute("label", menuItem.getAttribute("labeltempl").replace(/\?1\?/, filter.text));
    menuItem.hidden = false;

    if (filter instanceof ActiveFilter && !filter.disabled && filter.subscriptions.length && !filter.subscriptions.some(function(subscription) !(subscription instanceof SpecialSubscription)))
    {
      let domain = null;
      try {
        domain = Utils.effectiveTLD.getBaseDomainFromHost(item.docDomain);
      } catch (e) {}

      if (domain && !filter.isActiveOnlyOnDomain(domain))
      {
        menuItem = E("contextDisableOnSite");
        menuItem.setAttribute("label", menuItem.getAttribute("labeltempl").replace(/\?1\?/, domain));
        menuItem.hidden = false;
      }
    }
  }

  E("contextWhitelist").hidden = ("tooltip" in item || !item.filter || item.filter.disabled || item.filter instanceof WhitelistFilter || item.typeDescr == "ELEMHIDE");
  E("contextBlock").hidden = !E("contextWhitelist").hidden;
  E("contextBlock").setAttribute("disabled", "filter" in item && item.filter && !item.filter.disabled);
  E("contextEditFilter").setAttribute("disabled", !("filter" in item && item.filter));
  E("contextOpen").setAttribute("disabled", "tooltip" in item || item.typeDescr == "ELEMHIDE");
  E("contextFlash").setAttribute("disabled", "tooltip" in item || !(item.typeDescr in visual) || (item.filter && !item.filter.disabled && !(item.filter instanceof WhitelistFilter)));
  E("contextCopyFilter").setAttribute("disabled", !allItems.some(function(item) {return "filter" in item && item.filter}));

  return true;
}

/**
 * Resets context menu data once the context menu is closed.
 */
function clearContextMenu(/**Event*/ event)
{
  if (event.eventPhase != event.AT_TARGET)
    return;

  {
    let menuItem = E("contextDisableOnSite");
    menuItem.item = item;
    menuItem.filter = filter;
    menuItem.domain = domain;
  }
}

/**
 * Processed mouse clicks on the item list.
 * @param {Event} event
 */
function handleClick(event)
{
  let item = treeView.getItemAt(event.clientX, event.clientY);
  if (event.button == 0 && treeView.getColumnAt(event.clientX, event.clientY) == "state")
  {
    if (item.filter)
      enableFilter(item.filter, item.filter.disabled);
    event.preventDefault();
  }
  else if (event.button == 1)
  {
    openInTab(item, event);
    event.preventDefault();
  }
}

/**
 * Processes double-clicks on the item list.
 * @param {Event} event
 */
function handleDblClick(event)
{
  if (event.button != 0 || treeView.getColumnAt(event.clientX, event.clientY) == "state")
    return;

  doBlock();
}

/**
 * Opens the item in a new tab.
 */
function openInTab(item, /**Event*/ event)
{
  let items = (item ? [item] : treeView.getAllSelectedItems());
  for each (let item in items)
  {
    if (item && item.typeDescr != "ELEMHIDE")
      UI.loadInBrowser(item.location, mainWin, event);
  }
}

function doBlock() {
  var item = treeView.getSelectedItem();
  if (!item || item.typeDescr == "ELEMHIDE")
    return;

  var filter = null;
  if (item.filter && !item.filter.disabled)
    filter = item.filter;

  if (filter && filter instanceof WhitelistFilter)
    return;

  openDialog("chrome://adblockplus/content/ui/composer.xul", "_blank", "chrome,centerscreen,resizable,dialog=no,dependent", item.nodes, item.orig);
}

function editFilter()
{
  var item = treeView.getSelectedItem();
  if (treeView.data && !treeView.data.length)
    item = treeView.getDummyTooltip();

  if (!("filter" in item) || !item.filter)
    return;

  if (!("location") in item)
    item.location = undefined

  UI.openFiltersDialog(item.filter);
}

function enableFilter(filter, enable) {
  filter.disabled = !enable;

  treeView.boxObject.invalidate();
}

/**
 * Edits the filter to disable it on a particular domain.
 */
function disableOnSite()
{
  let item = treeView.getSelectedItem();
  let filter = item.filter;
  if (!(filter instanceof ActiveFilter) || filter.disabled || !filter.subscriptions.length || filter.subscriptions.some(function(subscription) !(subscription instanceof SpecialSubscription)))
    return;

  let domain;
  try {
    domain = Utils.effectiveTLD.getBaseDomainFromHost(item.docDomain).toUpperCase();
  }
  catch (e)
  {
    return;
  }

  // Generate text for new filter that excludes current domain
  let text = filter.text;
  if (filter instanceof RegExpFilter)
  {
    let match = Filter.optionsRegExp.exec(text);
    if (match)
    {
      let found = false;
      let options = match[1].toUpperCase().split(",");
      for (let i = 0; i < options.length; i++)
      {
        let match = /^DOMAIN=(.*)/.exec(options[i]);
        if (match)
        {
          let domains = match[1].split("|").filter(function(d) d != domain && d != "~" + domain && (d.length <= domain.length || d.lastIndexOf("." + domain) != d.length - domain.length - 1));
          domains.push("~" + domain);
          options[i] = "DOMAIN=" + domains.join("|");
          found = true;
          break;
        }
      }
      if (!found)
        options.push("DOMAIN=~" + domain);

      text = text.replace(Filter.optionsRegExp, "$" + options.join(",").toLowerCase());
    }
    else
      text += "$domain=~" + domain.toLowerCase();
  }
  else if (filter instanceof ElemHideBase)
  {
    let match = /^([^#]+)(#.*)/.exec(text);
    if (match)
    {
      let selector = match[2];
      let domains = match[1].toUpperCase().split(",").filter(function(d) d != domain && (d.length <= domain.length || d != "~" + domain && d.lastIndexOf("." + domain) != d.length - domain.length - 1));
      domains.push("~" + domain);
      text = domains.join(",").toLowerCase() + selector;
    }
    else
      text = "~" + domain.toLowerCase() + text;
  }

  if (text == filter.text)
    return;   // Just in case, shouldn't happen

  // Insert new filter before the old one and remove the old one then
  let newFilter = Filter.fromText(text);
  if (newFilter.disabled && newFilter.subscriptions.length)
    newFilter.disabled = false;
  else if (!newFilter.subscriptions.length)
  {
    newFilter.disabled = false;
    let subscription = filter.subscriptions.filter(function(s) s instanceof SpecialSubscription)[0];
    if (subscription)
      FilterStorage.addFilter(newFilter, subscription, subscription.filters.indexOf(filter));
  }
  FilterStorage.removeFilter(filter);

  // Update display
  for (let i = 0; i < treeView.allData.length; i++)
    if (treeView.allData[i].filter == filter)
      treeView.allData[i].filter = null;
  treeView.boxObject.invalidate();
}

function copyToClipboard() {
  var items = treeView.getAllSelectedItems();
  if (!items.length)
    return;

  Utils.clipboardHelper.copyString(items.map(function(item) {return item.location}).join(IO.lineBreak));
}

function copyFilter() {
  var items = treeView.getAllSelectedItems().filter(function(item) {return item.filter});
  if (treeView.data && !treeView.data.length)
    items = [treeView.getDummyTooltip()];

  if (!items.length)
    return;

  Utils.clipboardHelper.copyString(items.map(function(item) {return item.filter.text}).join(IO.lineBreak));
}

function selectAll() {
  treeView.selectAll();
}

// Saves sidebar's state before detaching/reattaching
function saveState() {
  var focused = document.commandDispatcher.focusedElement;
  while (focused && (!focused.id || !("focus" in focused)))
    focused = focused.parentNode;

  // Calculate default position for the detached window
  var boxObject = document.documentElement.boxObject;
  var position = {screenX: boxObject.screenX, screenY: boxObject.screenY, width: boxObject.width, height: boxObject.height};

  var params = {
    filter: treeView.filter,
    focus: (focused ? focused.id : null),
    position: position
  };
  Utils.setParams(params);
}

// closes the sidebar
function doClose()
{
  mainWin.document.getElementById("abp-command-sidebar").doCommand();
}

// detaches/reattaches the sidebar
function detach(doDetach)
{
  saveState();

  // Store variables locally, global variables will go away when we are closed
  let myPrefs = Prefs;
  let myMainWin = mainWin;

  // Close sidebar and open detached window
  myMainWin.document.getElementById("abp-command-sidebar").doCommand();
  myPrefs.detachsidebar = doDetach;
  myMainWin.document.getElementById("abp-command-sidebar").doCommand();
}

// Returns items size in the document if available
function getItemSize(item)
{
  if (item.filter && !item.filter.disabled && item.filter instanceof BlockingFilter)
    return null;

  for each (let node in item.nodes)
  {
    if (node instanceof HTMLImageElement && (node.naturalWidth || node.naturalHeight))
      return [node.naturalWidth, node.naturalHeight];
    else if (node instanceof HTMLElement && (node.offsetWidth || node.offsetHeight))
      return [node.offsetWidth, node.offsetHeight];
  }
  return null;
}

// Sort functions for the item list
function sortByAddress(item1, item2) {
  if (item1.location < item2.location)
    return -1;
  else if (item1.location > item2.location)
    return 1;
  else
    return 0;
}

function sortByAddressDesc(item1, item2) {
  return -sortByAddress(item1, item2);
}

function compareType(item1, item2) {
  if (item1.localizedDescr < item2.localizedDescr)
    return -1;
  else if (item1.localizedDescr > item2.localizedDescr)
    return 1;
  else
    return 0;
}

function compareFilter(item1, item2) {
  var hasFilter1 = (item1.filter ? 1 : 0);
  var hasFilter2 = (item2.filter ? 1 : 0);
  if (hasFilter1 != hasFilter2)
    return hasFilter1 - hasFilter2;
  else if (hasFilter1 && item1.filter.text < item2.filter.text)
    return -1;
  else if (hasFilter1 && item1.filter.text > item2.filter.text)
    return 1;
  else
    return 0;
}

function compareState(item1, item2) {
  var state1 = (!item1.filter ? 0 : (item1.filter.disabled ? 1 : (item1.filter instanceof WhitelistFilter ? 2 : 3)));
  var state2 = (!item2.filter ? 0 : (item2.filter.disabled ? 1 : (item2.filter instanceof WhitelistFilter ? 2 : 3)));
  return state1 - state2;
}

function compareSize(item1, item2) {
  var size1 = getItemSize(item1);
  size1 = size1 ? size1[0] * size1[1] : 0;

  var size2 = getItemSize(item2);
  size2 = size2 ? size2[0] * size2[1] : 0;
  return size1 - size2;
}

function compareDocDomain(item1, item2)
{
  if (item1.docDomain < item2.docDomain)
    return -1;
  else if (item1.docDomain > item2.docDomain)
    return 1;
  else if (item1.thirdParty && !item2.thirdParty)
    return -1;
  else if (!item1.thirdParty && item2.thirdParty)
    return 1;
  else
    return 0;
}

function compareFilterSource(item1, item2)
{
  let subs1 = item1.filter ? item1.filter.subscriptions.map(function(s) s.title).join(", ") : "";
  let subs2 = item2.filter ? item2.filter.subscriptions.map(function(s) s.title).join(", ") : "";
  if (subs1 < subs2)
    return -1;
  else if (subs1 > subs2)
    return 1;
  else
    return 0;
}

function createSortWithFallback(cmpFunc, fallbackFunc, desc) {
  var factor = (desc ? -1 : 1);
  return function(item1, item2) {
    var ret = cmpFunc(item1, item2);
    if (ret == 0)
      return fallbackFunc(item1, item2);
    else
      return factor * ret;
  }
}

// Item list's tree view object
var treeView = {
  //
  // nsISupports implementation
  //

  QueryInterface: function(uuid) {
    if (!uuid.equals(Ci.nsISupports) &&
        !uuid.equals(Ci.nsITreeView))
    {
      throw Cr.NS_ERROR_NO_INTERFACE;
    }

    return this;
  },

  //
  // nsITreeView implementation
  //

  selection: null,

  setTree: function(boxObject) {
    if (!boxObject)
      return;
    this.boxObject = boxObject;
    this.itemsDummy = boxObject.treeBody.getAttribute("noitemslabel");
    this.whitelistDummy = boxObject.treeBody.getAttribute("whitelistedlabel");
    var stringAtoms = ["col-address", "col-type", "col-filter", "col-state", "col-size", "col-docDomain", "col-filterSource", "state-regular", "state-filtered", "state-whitelisted", "state-hidden", "state-hiddenexception"];
    var boolAtoms = ["selected", "dummy", "filter-disabled"];
    var atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
    this.atoms = {};
    for each (let atom in stringAtoms)
      this.atoms[atom] = atomService.getAtom(atom);
    for each (let atom in boolAtoms)
    {
      this.atoms[atom + "-true"] = atomService.getAtom(atom + "-true");
      this.atoms[atom + "-false"] = atomService.getAtom(atom + "-false");
    }

    this.itemsDummyTooltip = Utils.getString("no_blocking_suggestions");
    this.whitelistDummyTooltip = Utils.getString("whitelisted_page");

    // Check current sort direction
    var cols = document.getElementsByTagName("treecol");
    var sortDir = null;
    for (let i = 0; i < cols.length; i++) {
      var col = cols[i];
      var dir = col.getAttribute("sortDirection");
      if (dir && dir != "natural") {
        this.sortColumn = col;
        sortDir = dir;
      }
    }
    if (!this.sortColumn)
    {
      let defaultSort = E("list").getAttribute("defaultSort");
      let match = /^(\w+)\s+(ascending|descending)$/.exec(defaultSort);
      if (match)
      {
        this.sortColumn = E(match[1]);
        if (this.sortColumn)
        {
          sortDir = match[2];
          this.sortColumn.setAttribute("sortDirection", sortDir);
        }
      }
    }

    if (sortDir)
    {
      this.sortProc = this.sortProcs[this.sortColumn.id + (sortDir == "descending" ? "Desc" : "")];
      E("list").setAttribute("defaultSort", " ");
    }

    // Make sure to update the dummy row every two seconds
    setInterval(function(view) {
      if (!view.data || !view.data.length)
        view.boxObject.invalidateRow(0);
    }, 2000, this);

    // Prevent a reference through closures
    boxObject = null;
  },
  get rowCount() {
    return (this.data && this.data.length ? this.data.length : 1);
  },
  getCellText: function(row, col) {
    col = col.id;
    if (col != "type" && col != "address" && col != "filter" && col != "size" && col != "docDomain" && col != "filterSource")
      return "";
    if (this.data && this.data.length) {
      if (row >= this.data.length)
        return "";
      if (col == "type")
        return this.data[row].localizedDescr;
      else if (col == "filter")
        return (this.data[row].filter ? this.data[row].filter.text : "");
      else if (col == "size")
      {
        let size = getItemSize(this.data[row]);
        return (size ? size.join(" x ") : "");
      }
      else if (col == "docDomain")
        return this.data[row].docDomain + " " + (this.data[row].thirdParty ? docDomainThirdParty : docDomainFirstParty);
      else if (col == "filterSource")
      {
        if (!this.data[row].filter)
          return "";

        return this.data[row].filter.subscriptions.filter(function(s) !s.disabled).map(function(s) s.title).join(", ");
      }
      else
        return this.data[row].location;
    }
    else {
      // Empty list, show dummy
      if (row > 0 || (col != "address" && col != "filter"))
        return "";
      if (col == "filter") {
        var filter = Policy.isWindowWhitelisted(window.content);
        return filter ? filter.text : "";
      }

      return (Policy.isWindowWhitelisted(window.content) ? this.whitelistDummy : this.itemsDummy);
    }
  },

  generateProperties: function(list, properties)
  {
    if (properties)
    {
      // Gecko 21 and below: we have an nsISupportsArray parameter, add atoms
      // to that.
      for (let i = 0; i < list.length; i++)
        if (list[i] in this.atoms)
          properties.AppendElement(this.atoms[list[i]]);
      return null;
    }
    else
    {
      // Gecko 22+: no parameter, just return a string
      return list.join(" ");
    }
  },

  getColumnProperties: function(col, properties)
  {
    return this.generateProperties(["col-" + col.id], properties);
  },

  getRowProperties: function(row, properties)
  {
    if (row >= this.rowCount)
      return "";

    let list = [];
    list.push("selected-" + this.selection.isSelected(row));

    let state;
    if (this.data && this.data.length) {
      list.push("dummy-false");

      let filter = this.data[row].filter;
      if (filter)
        list.push("filter-disabled-" + filter.disabled);

      state = "state-regular";
      if (filter && !filter.disabled)
      {
        if (filter instanceof WhitelistFilter)
          state = "state-whitelisted";
        else if (filter instanceof BlockingFilter)
          state = "state-filtered";
        else if (filter instanceof ElemHideFilter)
          state = "state-hidden";
        else if (filter instanceof ElemHideException)
          state = "state-hiddenexception";
      }
    }
    else {
      list.push("dummy-true");

      state = "state-filtered";
      if (this.data && Policy.isWindowWhitelisted(window.content))
        state = "state-whitelisted";
    }
    list.push(state);
    return this.generateProperties(list, properties);
  },

  getCellProperties: function(row, col, properties)
  {
    return this.getRowProperties(row, properties) + " " + this.getColumnProperties(col, properties);
  },

  cycleHeader: function(col) {
    col = col.id;

    col = E(col);
    if (!col)
      return;

    var cycle = {
      natural: 'ascending',
      ascending: 'descending',
      descending: 'natural'
    };

    var curDirection = "natural";
    if (this.sortColumn == col)
      curDirection = col.getAttribute("sortDirection");
    else if (this.sortColumn)
      this.sortColumn.removeAttribute("sortDirection");

    curDirection = cycle[curDirection];

    if (curDirection == "natural")
      this.sortProc = null;
    else
      this.sortProc = this.sortProcs[col.id + (curDirection == "descending" ? "Desc" : "")];

    if (this.data)
      this.refilter();

    col.setAttribute("sortDirection", curDirection);
    this.sortColumn = col;

    this.boxObject.invalidate();
  },

  isSorted: function() {
    return this.sortProc;
  },

  isContainer: function() {return false},
  isContainerOpen: function() {return false},
  isContainerEmpty: function() {return false},
  getLevel: function() {return 0},
  getParentIndex: function() {return -1},
  hasNextSibling: function() {return false},
  toggleOpenState: function() {},
  canDrop: function() {return false},
  drop: function() {},
  getCellValue: function() {return null},
  getProgressMode: function() {return null},
  getImageSrc: function() {return null},
  isSeparator: function() {return false},
  isEditable: function() {return false},
  cycleCell: function() {},
  performAction: function() {},
  performActionOnRow: function() {},
  performActionOnCell: function() {},
  selectionChanged: function() {},

  //
  // Custom properties and methods
  //

  boxObject: null,
  atoms: null,
  filter: "",
  data: null,
  allData: [],
  dataMap: {__proto__: null},
  sortColumn: null,
  sortProc: null,
  resortTimeout: null,
  itemsDummy: null,
  whitelistDummy: null,
  itemsDummyTooltip: null,
  whitelistDummyTooltip: null,
  itemToSelect: null,

  sortProcs: {
    address: sortByAddress,
    addressDesc: sortByAddressDesc,
    type: createSortWithFallback(compareType, sortByAddress, false),
    typeDesc: createSortWithFallback(compareType, sortByAddress, true),
    filter: createSortWithFallback(compareFilter, sortByAddress, false),
    filterDesc: createSortWithFallback(compareFilter, sortByAddress, true),
    state: createSortWithFallback(compareState, sortByAddress, false),
    stateDesc: createSortWithFallback(compareState, sortByAddress, true),
    size: createSortWithFallback(compareSize, sortByAddress, false),
    sizeDesc: createSortWithFallback(compareSize, sortByAddress, true),
    docDomain: createSortWithFallback(compareDocDomain, sortByAddress, false),
    docDomainDesc: createSortWithFallback(compareDocDomain, sortByAddress, true),
    filterSource: createSortWithFallback(compareFilterSource, sortByAddress, false),
    filterSourceDesc: createSortWithFallback(compareFilterSource, sortByAddress, true)
  },
  clearData: function(data) {
    var oldRows = this.rowCount;
    this.allData = [];
    this.dataMap = {__proto__: null};
    this.refilter();

    this.boxObject.rowCountChanged(0, -oldRows);
    this.boxObject.rowCountChanged(0, this.rowCount);
  },

  addItem: function(/**Node*/ node, /**RequestEntry*/ item, /**Boolean*/ scanComplete)
  {
    // Merge duplicate entries
    let key = item.location + " " + item.type + " " + item.docDomain;
    if (key in this.dataMap)
    {
      // We know this item already - take over the filter if any and be done with it
      let existing = this.dataMap[key];
      if (item.filter)
        existing.filter = item.filter;

      existing.nodes.push(node);
      this.invalidateItem(existing);
      return;
    }

    // Add new item to the list
    // Store original item in orig property - reading out prototype is messed up in Gecko 1.9.2
    item = {__proto__: item, orig: item, nodes: [node]};
    this.allData.push(item);
    this.dataMap[key] = item;

    // Show disabled filters if no other filter applies
    if (!item.filter)
      item.filter = disabledMatcher.matchesAny(item.location, item.typeDescr, item.docDomain, item.thirdParty);

    if (!this.matchesFilter(item))
      return;

    let index = -1;
    if (this.sortProc && this.sortColumn && this.sortColumn.id == "size")
    {
      // Sorting by size requires accessing content document, and that's
      // dangerous from a content policy (and we are likely called directly
      // from a content policy call). Size data will be inaccurate anyway,
      // delay sorting until later.
      if (this.resortTimeout)
        clearTimeout(this.resortTimeout);
      this.resortTimeout = setTimeout(function(me)
      {
        if (me.sortProc)
          me.data.sort(me.sortProc);
        me.boxObject.invalidate();
      }, 500, this);
    }
    else if (this.sortProc)
      for (var i = 0; index < 0 && i < this.data.length; i++)
        if (this.sortProc(item, this.data[i]) < 0)
          index = i;

    if (index >= 0)
      this.data.splice(index, 0, item);
    else {
      this.data.push(item);
      index = this.data.length - 1;
    }

    if (this.data.length == 1)
      this.boxObject.invalidateRow(0);
    else
      this.boxObject.rowCountChanged(index, 1);

    if (this.itemToSelect == key)
    {
      this.selection.select(index);
      this.boxObject.ensureRowIsVisible(index);
      this.itemToSelect = null;
    }
    else if (!scanComplete && this.selection.currentIndex >= 0) // Keep selected row visible while scanning
      this.boxObject.ensureRowIsVisible(this.selection.currentIndex);
  },

  updateFilters: function()
  {
    for each (let item in this.allData)
    {
      if (item.filter instanceof RegExpFilter && item.filter.disabled)
        delete item.filter;
      if (!item.filter)
        item.filter = disabledMatcher.matchesAny(item.location, item.typeDescr, item.docDomain, item.thirdParty);
    }
    this.refilter();
  },

  /**
   * Updates the list after a filter or sorting change.
   */
  refilter: function()
  {
    if (this.resortTimeout)
      clearTimeout(this.resortTimeout);

    this.data = this.allData.filter(this.matchesFilter, this);

    if (this.sortProc)
      this.data.sort(this.sortProc);
  },

  /**
   * Tests whether an item matches current list filter.
   * @return {Boolean} true if the item should be shown
   */
  matchesFilter: function(item)
  {
    if (!this.filter)
      return true;

    return (item.location.toLowerCase().indexOf(this.filter) >= 0 ||
            (item.filter && item.filter.text.toLowerCase().indexOf(this.filter) >= 0) ||
            item.typeDescr.toLowerCase().indexOf(this.filter.replace(/-/g, "_")) >= 0 ||
            item.localizedDescr.toLowerCase().indexOf(this.filter) >= 0 ||
            (item.docDomain && item.docDomain.toLowerCase().indexOf(this.filter) >= 0) ||
            (item.docDomain && item.thirdParty && docDomainThirdParty.toLowerCase().indexOf(this.filter) >= 0) ||
            (item.docDomain && !item.thirdParty && docDomainFirstParty.toLowerCase().indexOf(this.filter) >= 0));
  },

  setFilter: function(filter) {
    var oldRows = this.rowCount;

    this.filter = filter.toLowerCase();
    this.refilter();

    var newRows = this.rowCount;
    if (oldRows != newRows)
      this.boxObject.rowCountChanged(oldRows < newRows ? oldRows : newRows, this.rowCount - oldRows);
    this.boxObject.invalidate();
  },

  selectAll: function() {
    this.selection.selectAll();
  },

  getSelectedItem: function() {
    if (!this.data || this.selection.currentIndex < 0 || this.selection.currentIndex >= this.data.length)
      return null;

    return this.data[this.selection.currentIndex];
  },

  getAllSelectedItems: function() {
    let result = [];
    if (!this.data)
      return result;

    let numRanges = this.selection.getRangeCount();
    for (let i = 0; i < numRanges; i++)
    {
      let min = {};
      let max = {};
      let range = this.selection.getRangeAt(i, min, max);
      for (let j = min.value; j <= max.value; j++)
      {
        if (j >= 0 && j < this.data.length)
          result.push(this.data[j]);
      }
    }
    return result;
  },

  getItemAt: function(x, y)
  {
    if (!this.data)
      return null;

    var row = this.boxObject.getRowAt(x, y);
    if (row < 0 || row >= this.data.length)
      return null;

    return this.data[row];
  },

  getColumnAt: function(x, y)
  {
    if (!this.data)
      return null;

    let col = {};
    this.boxObject.getCellAt(x, y, {}, col, {});
    return (col.value ? col.value.id : null);
  },

  getDummyTooltip: function() {
    if (!this.data || this.data.length)
      return null;

    var filter = Policy.isWindowWhitelisted(window.content);
    if (filter)
      return {tooltip: this.whitelistDummyTooltip, filter: filter};
    else
      return {tooltip: this.itemsDummyTooltip};
  },

  invalidateItem: function(item)
  {
    let row = this.data.indexOf(item);
    if (row >= 0)
      this.boxObject.invalidateRow(row);
  }
}
