/*
 * This file is part of Privacy Badger <https://eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 * Derived from Adblock Plus 
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

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

if (!("enabled" in localStorage)){
  localStorage.enabled = "true";
}

with(require("filterClasses")) {
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses")) {
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var ElemHide = require("elemHide").ElemHide;
var defaultMatcher = require("matcher").defaultMatcher;
var matcherStore = require("matcher").matcherStore;
var activeMatchers = require("matcher").activeMatchers;
var Prefs = require("prefs").Prefs;
var Synchronizer = require("synchronizer").Synchronizer;
var Utils = require("utils").Utils;
var CookieBlockList = require("cookieblocklist").CookieBlockList;
var BlockedDomainList = require("blockedDomainList").BlockedDomainList;
var HeuristicBlocking = require("heuristicblocking");
var SocialWidgetLoader = require("socialwidgetloader");

// Load social widgets
var socialwidgets = SocialWidgetLoader.loadSocialWidgetsFromFile("socialwidgets.json");
console.log(socialwidgets);

// Some types cannot be distinguished
RegExpFilter.typeMap.OBJECT_SUBREQUEST = RegExpFilter.typeMap.OBJECT;
RegExpFilter.typeMap.MEDIA = RegExpFilter.typeMap.FONT = RegExpFilter.typeMap.OTHER;

if (!("whitelistUrl" in localStorage)){
  localStorage.whitelistUrl = "https://www.eff.org/files/cookieblocklist.txt";;
}

var whitelistUrl = localStorage.whitelistUrl;
var isFirstRun = false;
var seenDataCorruption = false;

// load cookieblocklist whenever a window is created
chrome.windows.onCreated.addListener(function(){
  CookieBlockList.updateDomains();
  BlockedDomainList.updateDomains();
  FakeCookieStore.updateCookies();
  
});
chrome.storage.onChanged.addListener(function(){
  CookieBlockList.updateDomains();
  BlockedDomainList.updateDomains();
  FakeCookieStore.updateCookies();
});

require("filterNotifier").FilterNotifier.addListener(function(action)
{
  if (action == "load")
  {
    importOldData();

    var addonVersion = require("info").addonVersion;
    var prevVersion = localStorage["currentVersion"];
    if (prevVersion != addonVersion)
    {
      changePrivacySettings();
      isFirstRun = !prevVersion;
      localStorage["currentVersion"] = addonVersion;
      addSubscription(prevVersion);
    }
  }
});

// Special-case domains for which we cannot use style-based hiding rules.
// See http://crbug.com/68705.
var noStyleRulesHosts = ["mail.google.com", "mail.yahoo.com", "www.google.com"];

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
}

// Upgrade options before we do anything else.
setDefaultOptions();

// wrappers to be called by popup.js
function getAction(tabId, origin) {
  return activeMatchers.getAction(tabId, origin);
}

function requestWouldBeBlocked(tabId, origin) {
  var action = getAction(tabId, origin);
  return action == "block" || action == "userblock"
}

function getAllOriginsForTab(tabId) {
  return activeMatchers.getAllOriginsForTab(tabId);
}

function removeFilter(subscriptionName, filterName){
  var subscription = FilterStorage.knownSubscriptions[subscriptionName];
  var filter = {};
  var i;
  for( i = 0; i < subscription.filters.length; i++){
    if(subscription.filters[i].text == filterName){
      filter = subscription.filters[i];
      break;
    }
  }
  console.log('REMOVING FILTER', filter, subscription);
  FilterStorage.removeFilter(filter,subscription);
}
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
  // todo: also check for whitelisted urls
  var iconFilename = Utils.isPrivacyBadgerEnabled(extractHostFromURL(tab.url)) ? {"19": "icons/badger-19.png", "38": "icons/badger-38.png"} : {"19": "icons/badger-19-disabled.png", "38": "icons/badger-38-disabled.png"};
  chrome.pageAction.setIcon({tabId: tab.id, path: iconFilename});

  // Only show icon for pages we can influence (http: and https:)
  if(/^https?:/.test(tab.url))
  {
    chrome.pageAction.setTitle({tabId: tab.id, title: "Privacy Badger"});
    if ("shouldShowIcon" in localStorage && localStorage["shouldShowIcon"] == "false")
      chrome.pageAction.hide(tab.id);
    else
      chrome.pageAction.show(tab.id);

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
 * Called on extension install/update: improves default privacy settings
 */
function changePrivacySettings()
{
  // todo: wrap these functions
  // cookies and referers blocked manually per-request; to block wholesale, uncomment
  // the lines below
  // chrome.privacy.websites.thirdPartyCookiesAllowed.set({'value': false, 'scope': 'regular'});
  // chrome.privacy.websites.referrersEnabled.set({'value': false, 'scope': 'regular'});
  console.log("Turning off hyperlink auditing");
  chrome.privacy.websites.hyperlinkAuditingEnabled.set({'value': false, 'scope': 'regular'});
  // todo: detect if user is using windows and turn off protectedContentEnabled if so
  //console.log("Turning off protected content unique ids (Windows)");
  //chrome.privacy.websites.protectedContentEnabled.set({'value': false, 'scope': 'regular'});
  console.log("Turning off Google Suggest");
  chrome.privacy.services.searchSuggestEnabled.set({'value': false, 'scope': 'regular'});
  console.log("Turning off alternate Error pages");
  chrome.privacy.services.alternateErrorPagesEnabled.set({'value': false, 'scope': 'regular'});
}

/**
 * This function is called on an extension update. It will add the default
 * filter subscription if necessary.
 */
function addSubscription(prevVersion)
{
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

  // Add EFF whitelist subscription
  try {
    var EFFsubscription = Subscription.fromURL(whitelistUrl);
    if (EFFsubscription && !(EFFsubscription.url in FilterStorage.knownSubscriptions))
    {
      // EFFsubscription.disabled = false;
      EFFsubscription.title = "EFF Auto Whitelist";
      FilterStorage.addSubscription(EFFsubscription);
      Synchronizer.execute(EFFsubscription, false, false, true);
    }
  } catch (e) {
    console.log("Could not add EFF whitelist!");
  }

  // Add frequencyHeuristic Subscription
  var frequencySub = new SpecialSubscription("frequencyHeuristic", "frequencyHeuristic");
  FilterStorage.addSubscription(frequencySub);

  // Add userRed Subscription
  var userRed = new SpecialSubscription("userRed", "userRed");
  FilterStorage.addSubscription(userRed);

  // Add userYellow Subscription
  var userYellow = new SpecialSubscription("userYellow", "userYellow");
  FilterStorage.addSubscription(userYellow);

  // Add userGreen Subscription
  var userGreen = new SpecialSubscription("userGreen", "userGreen");
  FilterStorage.addSubscription(userGreen);

  if (!addSubscription)
    return;

  function notifyUser()
  {
    console.log("Calling firstRun page");
    chrome.tabs.create({
      url: chrome.extension.getURL("/skin/firstRun.html")
    });
  }

  notifyUser();
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

function setupCookieBlocking(domain){
  //adds domain to cookie block list and moves all cookies into the cookie store
  var baseDomain = getBaseDomain(domain);
  //console.log('ADDING to cookieblock list', baseDomain);
  CookieBlockList.addDomain(domain);
}

function teardownCookieBlocking(domain){
  CookieBlockList.removeDomain(domain);
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
      if( (filter instanceof BlockingFilter) && 
      requestWouldBeBlocked(tabId, requestHost) ) {
        var collapse = filter.collapse;
        if (collapse == null)
          collapse = (localStorage.hidePlaceholders != "false");
        sendResponse(collapse);
      } else {
        sendResponse(false);
      }
      break;
    case "get-domain-enabled-state":
      // Returns whether this domain is in the exclusion list.
      // The page action popup asks us this.
      if(sender.tab) {
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
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(changeInfo.status == "loading")
    refreshIconAndContextMenu(tab);
});

// Update icon if a tab is replaced or loaded from cache
chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId){
  chrome.tabs.get(addedTabId, function(tab){
    refreshIconAndContextMenu(tab);
  });
});

// Fetch acceptable privacy policy hashes from the EFF server
function updatePrivacyPolicyHashes(){
  var url = "https://eff.org/files/dnt-policies.json";
  Utils.xhrRequest(url,function(err,response){
    if(err){
      console.error('Problem fetching privacy badger policy hash list at', url, err.status, err.message);
      return;
    }
    localStorage['badgerHashes'] = response;
  });
}
//refresh hashes every 24 hours and also once on startup.
setInterval(updatePrivacyPolicyHashes,86400000)
updatePrivacyPolicyHashes();

//loop through all blocked domains and recheck any that need to be rechecked for a dnt-policy file
function recheckDNTPolicyForBlockedDomains(){
  for(var domain in BlockedDomainList.domains){
    if(Date.now() > BlockedDomainList.nextUpdateTime(domain)){
      BlockedDomainList.updateDomainCheckTime(domain);
      checkForDNTPolicy(domain);
    }
  }
}
setInterval(recheckDNTPolicyForBlockedDomains,BlockedDomainList.minThreshold);
recheckDNTPolicyForBlockedDomains();

//check a domain for a DNT policy and unblock it if it has one
function checkForDNTPolicy(domain){
  checkPrivacyBadgerPolicy(domain, function(success){
    if(success){
      console.log('adding', domain, 'to user whitelist due to badgerpolicy.txt');
      unblockOrigin(domain);
    }
  });
}

function moveCookiesToFakeCookieStore(){
  alert('called move cookies to fake store');
}

//asyncronously check if the domain has /.well-known/dnt-policy.txt and add it to the user whitelist if it does
var checkPrivacyBadgerPolicy = function(origin, callback){
  var successStatus = false;
  var url = "https://" + origin + "/.well-known/dnt-policy.txt";

  if(!privacyHashesDoExist()){
    console.log('not checking for privacy policy because there are no acceptable hashes!');
    callback(successStatus);
    return;
  }

  Utils.xhrRequest(url,function(err,response){
    if(err){
      //console.error('Problem fetching privacy badger policy at', url, err.status, err.message);
      callback(successStatus)
      return;
    }
    var hash = SHA1(response);
    if(isValidPolicyHash(hash)){
      successStatus = true;
    }
    callback(successStatus);
  });
}

var unblockOrigin = function(origin){
  var filter = Filter.fromText("||" + origin + "^$third-party");
  var policySubscription = FilterStorage.knownSubscriptions["userGreen"];
  FilterStorage.removeFilter(filter);
  FilterStorage.addFilter(filter, policySubscription);
  teardownCookieBlocking(origin);
}

//boolean are there any acceptable privacy policy hashes
function privacyHashesDoExist(){
  return !! localStorage['badgerHashes'] && Object.keys(JSON.parse(localStorage['badgerHashes'])).length > 0;
}

//check if a given hash is the hash of a valid privacy policy
function isValidPolicyHash(hash){
  if(!privacyHashesDoExist()){
    console.error('No privacy badger policy hashes in storage! Refreshing...');
    updatePrivacyPolicyHashes();
    return false;
  }

  var hashes = JSON.parse(localStorage['badgerHashes']);
  for(key in hashes){
    if(hash === hashes[key]){ return true; }
  }
  return false;
}

function moveCookiesToRealCookieStore(){
  alert('moving cookies to real cookie store');
}

function reloadTab(tabId){
  chrome.tabs.reload(tabId);
}
