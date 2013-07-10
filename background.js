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

with(require("filterClasses"))
{
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var ElemHide = require("elemHide").ElemHide;
var defaultMatcher = require("matcher").defaultMatcher;
var Prefs = require("prefs").Prefs;
var Synchronizer = require("synchronizer").Synchronizer;
var Utils = require("utils").Utils;

// Some types cannot be distinguished
RegExpFilter.typeMap.OBJECT_SUBREQUEST = RegExpFilter.typeMap.OBJECT;
RegExpFilter.typeMap.MEDIA = RegExpFilter.typeMap.FONT = RegExpFilter.typeMap.OTHER;

var isFirstRun = false;
var seenDataCorruption = false;
require("filterNotifier").FilterNotifier.addListener(function(action)
{
  if (action == "load")
  {
    importOldData();

    var addonVersion = require("info").addonVersion;
    var prevVersion = localStorage["currentVersion"];
    if (prevVersion != addonVersion)
    {
      isFirstRun = !prevVersion;
      localStorage["currentVersion"] = addonVersion;
      addSubscription(prevVersion);
    }
  }
});

// Special-case domains for which we cannot use style-based hiding rules.
// See http://crbug.com/68705.
var noStyleRulesHosts = ["mail.google.com", "mail.yahoo.com", "www.google.com"];

function removeDeprecatedOptions()
{
  var deprecatedOptions = ["specialCaseYouTube", "experimental", "disableInlineTextAds"];
  deprecatedOptions.forEach(function(option)
  {
    if (option in localStorage)
      delete localStorage[option];
  });
}

// Sets options to defaults, upgrading old options from previous versions as necessary
function setDefaultOptions()
{
  function defaultOptionValue(opt, val)
  {
    if(!(opt in localStorage))
      localStorage[opt] = val;
  }

  defaultOptionValue("shouldShowIcon", "true");
  defaultOptionValue("shouldShowBlockElementMenu", "true");

  removeDeprecatedOptions();
}

// Upgrade options before we do anything else.
setDefaultOptions();

/**
 * Checks whether a page is whitelisted.
 * @param {String} url
 * @param {String} [parentUrl] URL of the parent frame
 * @param {String} [type] content type to be checked, default is "DOCUMENT"
 * @return {Filter} filter that matched the URL or null if not whitelisted
 */
function isWhitelisted(url, parentUrl, type)
{
  // Ignore fragment identifier
  var index = url.indexOf("#");
  if (index >= 0)
    url = url.substring(0, index);

  var result = defaultMatcher.matchesAny(url, type || "DOCUMENT", extractHostFromURL(parentUrl || url), false);
  return (result instanceof WhitelistFilter ? result : null);
}

// Adds or removes page action icon according to options.
function refreshIconAndContextMenu(tab)
{
  // The tab could have been closed by the time this function is called
  if(!tab)
    return;

  var excluded = isWhitelisted(tab.url);
  var iconFilename = excluded ? "icons/abp-19-whitelisted.png" : "icons/abp-19.png";
  chrome.pageAction.setIcon({tabId: tab.id, path: iconFilename});

  // Only show icon for pages we can influence (http: and https:)
  if(/^https?:/.test(tab.url))
  {
    chrome.pageAction.setTitle({tabId: tab.id, title: "Adblock Plus"});
    if ("shouldShowIcon" in localStorage && localStorage["shouldShowIcon"] == "false")
      chrome.pageAction.hide(tab.id);
    else
      chrome.pageAction.show(tab.id);

    // Set context menu status according to whether current tab has whitelisted domain
    if (excluded)
      chrome.contextMenus.removeAll();
    else
      showContextMenu();
  }
}

/**
 * Old versions stored filter data in the localStorage object, this will import
 * it into FilterStorage properly.
 */
function importOldData()
{
  function addSubscription(url, title)
  {
    try
    {
      var subscription = Subscription.fromURL(url);
      if (subscription && !(subscription.url in FilterStorage.knownSubscriptions))
      {
        if (title)
          subscription.title = title;
        FilterStorage.addSubscription(subscription);
        Synchronizer.execute(subscription);
      }
    }
    catch (e)
    {
      reportError(e);
    }
  }

  // Import user-defined subscriptions
  if (typeof localStorage["userFilterURLs"] == "string")
  {
    try
    {
      var urls = JSON.parse(localStorage["userFilterURLs"]);
      for (var key in urls)
        addSubscription(urls[key]);
      delete localStorage["userFilterURLs"];
    }
    catch (e)
    {
      reportError(e);
    }
  }

  // Now import predefined subscriptions if enabled
  if (typeof localStorage["filterFilesEnabled"] == "string")
  {
    try
    {
      var subscriptions = JSON.parse(localStorage["filterFilesEnabled"]);
      if (subscriptions.korea)
        subscriptions.easylist = true;
      if (subscriptions.france)
      {
        addSubscription("https://easylist-downloads.adblockplus.org/liste_fr+easylist.txt", "Liste FR+EasyList");
        subscriptions.easylist = false;
      }
      if (subscriptions.germany)
      {
        if (subscriptions.easylist)
          addSubscription("https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt", "EasyList Germany+EasyList");
        else
          addSubscription("https://easylist-downloads.adblockplus.org/easylistgermany.txt", "EasyList Germany");
        subscriptions.easylist = false;
      }
      if (subscriptions.china)
      {
        if (subscriptions.easylist)
          addSubscription("https://easylist-downloads.adblockplus.org/chinalist+easylist.txt", "ChinaList+EasyList");
        else
          addSubscription("http://adblock-chinalist.googlecode.com/svn/trunk/adblock.txt", "ChinaList");
        subscriptions.easylist = false;
      }
      if (subscriptions.russia)
      {
        if (subscriptions.easylist)
          addSubscription("https://easylist-downloads.adblockplus.org/ruadlist+easylist.txt", "RU AdList+EasyList");
        else
          addSubscription("https://ruadlist.googlecode.com/svn/trunk/advblock.txt", "RU AdList");
        subscriptions.easylist = false;
      }
      if (subscriptions.romania)
      {
        if (subscriptions.easylist)
          addSubscription("https://easylist-downloads.adblockplus.org/rolist+easylist.txt", "ROList+EasyList");
        else
          addSubscription("http://www.zoso.ro/pages/rolist.txt", "ROList");
        subscriptions.easylist = false;
      }
      if (subscriptions.easylist)
        addSubscription("https://easylist-downloads.adblockplus.org/easylist.txt", "EasyList");
      if (subscriptions.fanboy)
        addSubscription("https://secure.fanboy.co.nz/fanboy-adblock.txt", "Fanboy's List");
      if (subscriptions.fanboy_es)
        addSubscription("https://secure.fanboy.co.nz/fanboy-espanol.txt", "Fanboy's Espa\xF1ol/Portugu\xEAs");
      if (subscriptions.italy)
        addSubscription("http://mozilla.gfsolone.com/filtri.txt", "Xfiles");
      if (subscriptions.poland)
        addSubscription("http://www.niecko.pl/adblock/adblock.txt", "PLgeneral");
      if (subscriptions.hungary)
        addSubscription("http://pete.teamlupus.hu/hufilter.txt", "hufilter");
      if (subscriptions.extras)
        addSubscription("https://easylist-downloads.adblockplus.org/chrome_supplement.txt", "Recommended filters for Google Chrome");

      delete localStorage["filterFilesEnabled"];
    }
    catch (e)
    {
      reportError(e);
    }
  }

  // Import user filters
  if(typeof localStorage["userFilters"] == "string")
  {
    try
    {
      var userFilters = JSON.parse(localStorage["userFilters"]);
      for (var i = 0; i < userFilters.length; i++)
      {
        var filterText = userFilters[i];

        // Skip useless default filters
        if (filterText == "qux.us###annoying_AdDiv" || filterText == "qux.us##.ad_class")
          continue;

        var filter = Filter.fromText(filterText);
        FilterStorage.addFilter(filter);
      }
      delete localStorage["userFilters"];
    }
    catch (e)
    {
      reportError(e);
    }
  }

  // Import "excluded domains"
  if(typeof localStorage["excludedDomains"] == "string")
  {
    try
    {
      var excludedDomains = JSON.parse(localStorage["excludedDomains"]);
      for (var domain in excludedDomains)
      {
        var filterText = "@@||" + domain + "^$document";
        var filter = Filter.fromText(filterText);
        FilterStorage.addFilter(filter);
      }
      delete localStorage["excludedDomains"];
    }
    catch (e)
    {
      reportError(e);
    }
  }

  // Delete downloaded subscription data
  try
  {
    for (var key in localStorage)
      if (/^https?:/.test(key))
        delete localStorage[key];
  }
  catch (e)
  {
    reportError(e);
  }
}

/**
 * This function is called on an extension update. It will add the default
 * filter subscription if necessary.
 */
function addSubscription(prevVersion)
{
  // Make sure to remove "Recommended filters", no longer necessary
  var toRemove = "https://easylist-downloads.adblockplus.org/chrome_supplement.txt";
  if (toRemove in FilterStorage.knownSubscriptions)
    FilterStorage.removeSubscription(FilterStorage.knownSubscriptions[toRemove]);

  // Add "acceptable ads" subscription for new users and users updating from old ABP versions
  var addAcceptable = (!prevVersion || Services.vc.compare(prevVersion, "2.1") < 0);
  if (addAcceptable)
  {
    addAcceptable = !FilterStorage.subscriptions.some(function(subscription)
    {
      return subscription.url == Prefs.subscriptions_exceptionsurl;
    });
  }

  // Don't add subscription if the user has a subscription already
  var addSubscription = !FilterStorage.subscriptions.some(function(subscription)
  {
    return subscription instanceof DownloadableSubscription &&
           subscription.url != Prefs.subscriptions_exceptionsurl;
  });

  // If this isn't the first run, only add subscription if the user has no custom filters
  if (addSubscription && prevVersion)
  {
    addSubscription = !FilterStorage.subscriptions.some(function(subscription)
    {
      return subscription.url != Prefs.subscriptions_exceptionsurl &&
             subscription.filters.length;
    });
  }

  // Add "acceptable ads" subscription
  if (addAcceptable)
  {
    var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
    if (subscription)
    {
      subscription.title = "Allow non-intrusive advertising";
      FilterStorage.addSubscription(subscription);
      if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
        Synchronizer.execute(subscription);
    }
    else
      addAcceptable = false;
  }

  if (!addSubscription && !addAcceptable)
    return;

  function notifyUser()
  {
    chrome.tabs.create({
      url: chrome.extension.getURL("firstRun.html")
    });
  }

  if (addSubscription)
  {
    // Load subscriptions data
    var request = new XMLHttpRequest();
    request.open("GET", "subscriptions.xml");
    request.addEventListener("load", function()
    {
      var node = Utils.chooseFilterSubscription(request.responseXML.getElementsByTagName("subscription"));
      var subscription = (node ? Subscription.fromURL(node.getAttribute("url")) : null);
      if (subscription)
      {
        FilterStorage.addSubscription(subscription);
        subscription.disabled = false;
        subscription.title = node.getAttribute("title");
        subscription.homepage = node.getAttribute("homepage");
        if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
          Synchronizer.execute(subscription);

          notifyUser();
      }
    }, false);
    request.send(null);
  }
  else
    notifyUser();
}

// Set up context menu for user selection of elements to block
function showContextMenu()
{
  chrome.contextMenus.removeAll(function()
  {
    if(typeof localStorage["shouldShowBlockElementMenu"] == "string" && localStorage["shouldShowBlockElementMenu"] == "true")
    {
      chrome.contextMenus.create({'title': chrome.i18n.getMessage('block_element'), 'contexts': ['image', 'video', 'audio'], 'onclick': function(info, tab)
      {
        if(info.srcUrl)
            chrome.tabs.sendRequest(tab.id, {reqtype: "clickhide-new-filter", filter: info.srcUrl});
      }});
    }
  });
}

/**
 * Opens Options window or focuses an existing one.
 * @param {Function} callback  function to be called with the window object of
 *                             the Options window
 */
function openOptions(callback)
{
  function findOptions(selectTab)
  {
    var views = chrome.extension.getViews({type: "tab"});
    for (var i = 0; i < views.length; i++)
      if ("startSubscriptionSelection" in views[i])
        return views[i];

    return null;
  }

  function selectOptionsTab()
  {
    chrome.windows.getAll({populate: true}, function(windows)
    {
      var url = chrome.extension.getURL("options.html");
      for (var i = 0; i < windows.length; i++)
        for (var j = 0; j < windows[i].tabs.length; j++)
          if (windows[i].tabs[j].url == url)
            chrome.tabs.update(windows[i].tabs[j].id, {selected: true});
    });
  }

  var view = findOptions();
  if (view)
  {
    selectOptionsTab();
    callback(view);
  }
  else
  {
    var onLoad = function()
    {
      var view = findOptions();
      if (view)
        callback(view);
    };

    chrome.tabs.create({url: chrome.extension.getURL("options.html")}, function(tab)
    {
      if (tab.status == "complete")
        onLoad();
      else
      {
        var id = tab.id;
        var listener = function(tabId, changeInfo, tab)
        {
          if (tabId == id && changeInfo.status == "complete")
          {
            chrome.tabs.onUpdated.removeListener(listener);
            onLoad();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  }
}

/**
 * This function is a hack - we only know the tabId and document URL for a
 * message but we need to know the frame ID. Try to find it in webRequest's
 * frame data.
 */
function getFrameId(tabId, url)
{
  if (tabId in frames)
  {
    for (var f in frames[tabId])
    {
      if (getFrameUrl(tabId, f) == url)
        return f;
    }
  }
  return -1;
}

chrome.extension.onRequest.addListener(function(request, sender, sendResponse)
{
  switch (request.reqtype)
  {
    case "get-settings":
      var hostDomain = null;
      var selectors = null;

      var tabId = -1;
      var frameId = -1;
      if (sender.tab)
      {
        tabId = sender.tab.id;
        frameId = getFrameId(tabId, request.frameUrl);
      }

      var enabled = !isFrameWhitelisted(tabId, frameId, "DOCUMENT") && !isFrameWhitelisted(tabId, frameId, "ELEMHIDE");
      if (enabled && request.selectors)
      {
        var noStyleRules = false;
        var host = extractHostFromURL(request.frameUrl);
        hostDomain = getBaseDomain(host);
        for (var i = 0; i < noStyleRulesHosts.length; i++)
        {
          var noStyleHost = noStyleRulesHosts[i];
          if (host == noStyleHost || (host.length > noStyleHost.length &&
                                      host.substr(host.length - noStyleHost.length - 1) == "." + noStyleHost))
          {
            noStyleRules = true;
          }
        }
        selectors = ElemHide.getSelectorsForDomain(host, false);
        if (noStyleRules)
        {
          selectors = selectors.filter(function(s)
          {
            return !/\[style[\^\$]?=/.test(s);
          });
        }
      }

      sendResponse({enabled: enabled, hostDomain: hostDomain, selectors: selectors});
      break;
    case "should-collapse":
      var tabId = -1;
      var frameId = -1;
      if (sender.tab)
      {
        tabId = sender.tab.id;
        frameId = getFrameId(tabId, request.documentUrl);
      }

      if (isFrameWhitelisted(tabId, frameId, "DOCUMENT"))
      {
        sendResponse(false);
        break;
      }

      var requestHost = extractHostFromURL(request.url);
      var documentHost = extractHostFromURL(request.documentUrl);
      var thirdParty = isThirdParty(requestHost, documentHost);
      var filter = defaultMatcher.matchesAny(request.url, request.type, documentHost, thirdParty);
      if (filter instanceof BlockingFilter)
      {
        var collapse = filter.collapse;
        if (collapse == null)
          collapse = (localStorage.hidePlaceholders != "false");
        sendResponse(collapse);
      }
      else
        sendResponse(false);
      break;
    case "get-domain-enabled-state":
      // Returns whether this domain is in the exclusion list.
      // The page action popup asks us this.
      if(sender.tab)
      {
        sendResponse({enabled: !isWhitelisted(sender.tab.url)});
        return;
      }
      break;
    case "add-filters":
      if (request.filters && request.filters.length)
      {
        for (var i = 0; i < request.filters.length; i++)
          FilterStorage.addFilter(Filter.fromText(request.filters[i]));
      }
      break;
    case "add-subscription":
      openOptions(function(view)
      {
        view.startSubscriptionSelection(request.title, request.url);
      });
      break;
    case "forward":
      chrome.tabs.sendRequest(sender.tab.id, request.request, sendResponse);
      break;
    default:
      sendResponse({});
      break;
  }
});

// Show icon as page action for all tabs that already exist
chrome.windows.getAll({populate: true}, function(windows)
{
  for (var i = 0; i < windows.length; i++)
    for (var j = 0; j < windows[i].tabs.length; j++)
      refreshIconAndContextMenu(windows[i].tabs[j]);
});

// Update icon if a tab changes location
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab)
{
  chrome.tabs.sendRequest(tabId, {reqtype: "clickhide-deactivate"})
  if(changeInfo.status == "loading")
    refreshIconAndContextMenu(tab);
});
