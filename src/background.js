/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

if (!("socialWidgetReplacementEnabled" in localStorage)){
  localStorage.socialWidgetReplacementEnabled = "true";
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
var DomainExceptions = require("domainExceptions").DomainExceptions;
var HeuristicBlocking = require("heuristicblocking");
var SocialWidgetLoader = require("socialwidgetloader");

// Load social widgets
var SocialWidgetList = SocialWidgetLoader.loadSocialWidgetsFromFile("src/socialwidgets.json");

// Some types cannot be distinguished
RegExpFilter.typeMap.OBJECT_SUBREQUEST = RegExpFilter.typeMap.OBJECT;
RegExpFilter.typeMap.MEDIA = RegExpFilter.typeMap.FONT = RegExpFilter.typeMap.OTHER;

// Instantiate privacy badgers grey list
if (!("whitelistUrl" in localStorage)){
  localStorage.whitelistUrl = "https://www.eff.org/files/cookieblocklist.txt";
}

var whitelistUrl = localStorage.whitelistUrl;
var isFirstRun = false;
var seenDataCorruption = false;

require("filterNotifier").FilterNotifier.addListener(function(action) {
  // Called from lib/adblockplus.js after all filters have been created from subscriptions.
  if (action == "load") {
    // Update if newer version
    var currentVersion = chrome.runtime.getManifest().version;
    var prevVersion = localStorage.currentVersion;
    if (prevVersion != currentVersion) {
      migrateVersion(prevVersion, currentVersion);
    }
  }
});

// Load cookieblocklist and blocked domain listwhenever a window is created and whenever storage changes
chrome.windows.onCreated.addListener(function(){
  CookieBlockList.updateDomains();
  BlockedDomainList.updateDomains();

});
chrome.storage.onChanged.addListener(function(){
  CookieBlockList.updateDomains();
  BlockedDomainList.updateDomains();
});

/**
 * Runs methods that should be run when privacy badger is updated
 * @param {String} prevVersion The previous PB version
 * @param {String} currentVersion The current PB version
 */
function migrateVersion(prevVersion,currentVersion){
  changePrivacySettings();
  isFirstRun = !prevVersion;
  localStorage.currentVersion = currentVersion;
  addSubscription(prevVersion);
  updateTabList();
  migrateBlockedDomains();
  migrateCookieBlockList();
}

/**
 * migrates blocked domain list from chrome.storage to localStorage
 */
function migrateBlockedDomains() {
  var domains = JSON.parse(localStorage.getItem("blockeddomainslist"));
  if (domains && Object.keys(domains).length > 0){
    return;
  }
  chrome.storage.local.get("blockeddomainslist", function(items){
    if(chrome.runtime.lastError || !items.blockeddomainlist){
      return;
    }
    localStorage.setItem("blockeddomainslist", JSON.stringify(items.blockeddomainslist));
  });
}

/**
 * migrates cookie block list from chrome.storage to localStorage
 */
function migrateCookieBlockList() {
  var domains = JSON.parse(localStorage.getItem("cookieblocklist"));
  if (domains && Object.keys(domains).length > 0){
    return;
  }
  chrome.storage.local.get("cookieblocklist", function(items){
    if(chrome.runtime.lastError || !items.cookieblocklist){
      return;
    }
    out = {};
    for(var i = 0; i < items.length; i++){
      out[items[i]] = true;
    }
    localStorage.setItem("cookieblocklist", JSON.stringify(out));
  });
}

/**
 * Sets options to defaults, upgrading old options from previous versions as necessary
 */
function setDefaultOptions() {
  function defaultOptionValue(opt, val) {
    if(!(opt in localStorage)){
      localStorage[opt] = val;
    }
  }

  defaultOptionValue("shouldShowBlockElementMenu", "true");
}

// Upgrade options before we do anything else.
setDefaultOptions();

/**
 * Wrappers to be called by popup.js
 * Gets the action defined for the given tab/origin
 * @param {Integer} tabId The id to look up
 * @param {String} origin The URL of the 3rd party
 * @returns {String} The action defined for this tab/origin
 */
function getAction(tabId, origin) {
  return activeMatchers.getAction(tabId, origin);
}

/**
 * Determine if a request would be blocked
 * @param {Integer} tabId Tab Id to check if the 3rd party should be blocked in
 * @param {String} origin URL of 3rd party to check if it should be blocked
 * @return {Boolean} true if block is requested
 */
function requestWouldBeBlocked(tabId, origin) {
  var action = getAction(tabId, origin);
  return action == "block" || action == "userblock";
}

/**
 * Helper function returns a list of all blocked origins for a tab
 * @param {Integer} tabId requested tab id as provided by chrome
 * @returns {*} The list of blocked origins
 */
function getAllOriginsForTab(tabId) {
  return activeMatchers.getAllOriginsForTab(tabId);
}

/**
 * Helper function to remove a filter from privacy badger
 * @param {String} subscriptionName name of subscription
 * @param {String} filterName ABP style string representing filter
 */
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
 * @param {String} parentUrl URL of the parent frame
 * @param {String} type content type to be checked, default is "DOCUMENT"
 * @return {Filter} filter that matched the URL or null if not whitelisted
 */
function isWhitelisted(url, parentUrl, type) {
  // Ignore fragment identifier
  var index = url.indexOf("#");
  if (index >= 0) {
    url = url.substring(0, index);
  }

  var result = defaultMatcher.matchesAny(url, type || "DOCUMENT", extractHostFromURL(parentUrl || url), false);
  return (result instanceof WhitelistFilter ? result : null);
}

/**
 * Enables or disables page action icon according to options.
 * @param {Object} tab The tab to set the badger icon for
 */
function refreshIconAndContextMenu(tab) {
  if(!tab){return;}

  var iconFilename = Utils.isPrivacyBadgerEnabled(extractHostFromURL(tab.url)) ? {"19": "icons/badger-19.png", "38": "icons/badger-38.png"} : {"19": "icons/badger-19-disabled.png", "38": "icons/badger-38-disabled.png"};

  chrome.browserAction.setIcon({tabId: tab.id, path: iconFilename});
  chrome.browserAction.setTitle({tabId: tab.id, title: "Privacy Badger"});
}

/**
 * Called on extension install/update: improves default privacy settings
 */
function changePrivacySettings() {
  // If we have disabled search suggestion in a previous version return control to the user
  chrome.privacy.services.searchSuggestEnabled.get({}, function(details){
    if (details.levelOfControl === "controlled_by_this_extension") {
      chrome.privacy.services.searchSuggestEnabled.clear({scope: 'regular'}, function(){});
    }
  });

  console.log("Turning off alternate Error pages");
  chrome.privacy.services.alternateErrorPagesEnabled.set({'value': false, 'scope': 'regular'});
  console.log("Turning off hyperlink auditing");
  chrome.privacy.websites.hyperlinkAuditingEnabled.set({'value': false, 'scope': 'regular'});
}

/**
 * This function is called on an extension update. It will add the default
 * filter subscription if necessary.Also init the local DB and show the first use page
 * @param {String} prevVersion The previous PB version
 */
function addSubscription(prevVersion) {
  // Don't add subscription if the user has a subscription already
  var addSubscription = !FilterStorage.subscriptions.some(function(subscription) {
    return subscription instanceof DownloadableSubscription &&
           subscription.url != Prefs.subscriptions_exceptionsurl;
  });

  // If this isn't the first run, only add subscription if the user has no custom filters
  if (addSubscription && prevVersion) {
    addSubscription = !FilterStorage.subscriptions.some(function(subscription) {
      return subscription.url != Prefs.subscriptions_exceptionsurl &&
             subscription.filters.length;
    });
  }

  // Add EFF whitelist subscription
  try {
    var EFFsubscription = Subscription.fromURL(whitelistUrl);
    if (EFFsubscription && !(EFFsubscription.url in FilterStorage.knownSubscriptions)) {
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

  // Add a permanent store for seen third parties 
  // TODO: Does this go away when the extension is updated?
  var seenThird = JSON.parse(localStorage.getItem("seenThirdParties"));
  if (!seenThird){
    localStorage.setItem("seenThirdParties", JSON.stringify({}));
  }

  // Add a permanent store for supercookie domains
  var supercookieDomains = JSON.parse(localStorage.getItem("supercookieDomains"));
  if (!supercookieDomains){
    localStorage.setItem("supercookieDomains", JSON.stringify({}));
  }

  // Add a permanent store for blocked domains to recheck DNT compliance 
  // TODO: storing this in localStorage makes it synchronous, but we might 
  // want the speed up of async later if we want to deal with promises
  var blockedDomains = JSON.parse(localStorage.getItem("blockeddomainslist"));
  if (!blockedDomains){
    localStorage.setItem("blockeddomainslist", JSON.stringify({}));
  }

  if (!addSubscription) {
    return;
  }

  function notifyUser() {
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
function openOptions(callback) {

  /**
   *
   * @param selectTab Ignored
   * @returns {*}
   */
  function findOptions(selectTab) {
    var views = chrome.extension.getViews({type: "tab"});
    for (var i = 0; i < views.length; i++) {
      if ("startSubscriptionSelection" in views[i]) {
        return views[i];
      }
    }
    return null;
  }

  /**
   * Sets focus on existing PB options tab
   */
  function selectOptionsTab() {
    chrome.windows.getAll({populate: true}, function(windows) {
      var url = chrome.extension.getURL("options.html");
      for (var i = 0; i < windows.length; i++) {
        for (var j = 0; j < windows[i].tabs.length; j++) {
          if (windows[i].tabs[j].url == url) {
            chrome.tabs.update(windows[i].tabs[j].id, {selected: true});
          }
        }
      }
    });
  }

  var view = findOptions();
  if (view) {
    selectOptionsTab();
    callback(view);
  } else {
    var onLoad = function() {
      var view = findOptions();
      if (view) {
        callback(view);
      }
    };

    chrome.tabs.create({url: chrome.extension.getURL("options.html")}, function(tab) {
      if (tab.status == "complete") {
        onLoad();
      } else {
        var id = tab.id;
        var listener = function(tabId, changeInfo, tab) {
          if (tabId == id && changeInfo.status == "complete") {
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
 * @param {Integer} tabId tab id from chrome
 * @param {String} url url of request
 * @return {Integer} frameId or -1 on fail
 */
function getFrameId(tabId, url) {
  if (tabId in tabData) {
    for (var f in tabData[tabId].frames) {
      if (getFrameUrl(tabId, f) == url) {
        return f;
      }
    }
  }
  return -1;
}

/**
 * adds domain to cookie block list
 * @param {String} domain Domain to add
 */
function setupCookieBlocking(domain){
  var baseDomain = getBaseDomain(domain);
  // TODO should domain be baseDomain, or is the line above unnecessary?
  CookieBlockList.addDomain(domain);
}

/**
 * removes domain from cookie block list
 * @param {String} domain Domain to remove
 */
function teardownCookieBlocking(domain){
  CookieBlockList.removeDomain(domain);
}

/**
 * legacy adblock plus content script request handlers
 * TODO: get rid of these
 */
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  switch (request.reqtype) {
    case "get-settings":
      var hostDomain = null;
      var selectors = null;

      var tabId = -1;
      var frameId = -1;
      if (sender.tab) {
        tabId = sender.tab.id;
        frameId = getFrameId(tabId, request.frameUrl);
      }

      var enabled = !isFrameWhitelisted(tabId, frameId, "DOCUMENT") && !isFrameWhitelisted(tabId, frameId, "ELEMHIDE")&& Utils.isPrivacyBadgerEnabled(getHostForTab(tabId));
      if (enabled && request.selectors) {
        // Special-case domains for which we cannot use style-based hiding rules.
        // See http://crbug.com/68705.
        var noStyleRulesHosts = ["mail.google.com", "mail.yahoo.com", "www.google.com"];
        var noStyleRules = false;
        var host = extractHostFromURL(request.frameUrl);
        hostDomain = getBaseDomain(host);
        for (var i = 0; i < noStyleRulesHosts.length; i++) {
          var noStyleHost = noStyleRulesHosts[i];
          if (host == noStyleHost || (host.length > noStyleHost.length &&
                                      host.substr(host.length - noStyleHost.length - 1) == "." + noStyleHost)) {
            noStyleRules = true;
          }
        }
        selectors = ElemHide.getSelectorsForDomain(host, false);
        if (noStyleRules) {
          selectors = selectors.filter(function(s) {
            return !/\[style[\^\$]?=/.test(s);
          });
        }
      }
      sendResponse({enabled: enabled, hostDomain: hostDomain, selectors: selectors});
      break;
    case "should-collapse":
      var tabId = -1;
      var frameId = -1;
      if (sender.tab) {
        tabId = sender.tab.id;
        frameId = getFrameId(tabId, request.documentUrl);
      }

      if (isFrameWhitelisted(tabId, frameId, "DOCUMENT") ||
          isSocialWidgetTemporaryUnblock(tabId, request.url, frameId) ||
          !Utils.isPrivacyBadgerEnabled(getHostForTab(tabId)) ) {
        sendResponse(false);
        break;
      }

      var requestHost = extractHostFromURL(request.url);
      var documentHost = extractHostFromURL(request.documentUrl);
      var thirdParty = isThirdParty(requestHost, documentHost);
      var filter = defaultMatcher.matchesAny(request.url, request.type, documentHost, thirdParty);
      if( requestWouldBeBlocked(tabId, requestHost) ) {
        var collapse = filter.collapse;
        if (collapse === null) {
          collapse = (localStorage.hidePlaceholders != "false");
        }
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
      if (request.filters && request.filters.length) {
        for (var i = 0; i < request.filters.length; i++)
          FilterStorage.addFilter(Filter.fromText(request.filters[i]));
      }
      break;
    case "add-subscription":
      openOptions(function(view) {
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
chrome.windows.getAll({populate: true}, function(windows) {
  for (var i = 0; i < windows.length; i++) {
    for (var j = 0; j < windows[i].tabs.length; j++) {
      refreshIconAndContextMenu(windows[i].tabs[j]);
    }
  }
});

// Update icon if a tab changes location
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(changeInfo.status == "loading") {
    refreshIconAndContextMenu(tab);
  }
});

// Update icon if a tab is replaced or loaded from cache
chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId){
  chrome.tabs.get(addedTabId, function(tab){
    refreshIconAndContextMenu(tab);
  });
});

/**
 * Fetch acceptable privacy policy hashes from the EFF server
 */
function updatePrivacyPolicyHashes(){
  var url = "https://www.eff.org/files/dnt-policies.json";
  Utils.xhrRequest(url,function(err,response){
    if(err){
      console.error('Problem fetching privacy badger policy hash list at', url, err.status, err.message);
      return;
    }
    localStorage.badgerHashes = response;
  });
}

// Refresh hashes every 24 hours and also once on startup.
setInterval(updatePrivacyPolicyHashes,86400000);
updatePrivacyPolicyHashes();

// Refresh domain exceptions popup list once every 24 hours and on startup
setInterval(DomainExceptions.updateList,86400000);
DomainExceptions.updateList();

/**
 * Loop through all blocked domains and recheck any that need to be rechecked for a dnt-policy file
 * TODO: Check dnt domains to see if they have removed the policy
 */
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

/**
 * Check a domain for a DNT policy and unblock it if it has one
 * @param {String} domain The domain to check
 */
function checkForDNTPolicy(domain){
  checkPrivacyBadgerPolicy(domain, function(success){
    if(success){
      console.log('adding', domain, 'to user whitelist due to badgerpolicy.txt');
      unblockOrigin(domain);
    }
  });
}


/**
 * Asyncronously check if the domain has /.well-known/dnt-policy.txt and add it to the user whitelist if it does
 * @param {String} origin The host to check
 * @param {Function} callback callback(successStatus)
 */
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
      callback(successStatus);
      return;
    }
    var hash = SHA1(response);
    if(isValidPolicyHash(hash)){
      successStatus = true;
    }
    callback(successStatus);
  });
};

/**
 * Create a filter unblocking a given origin
 * @param {string} origin  the origin to unblock
 */
var unblockOrigin = function(origin){
  var filter = Filter.fromText("||" + origin + "^$third-party");
  var policySubscription = FilterStorage.knownSubscriptions.userGreen;
  FilterStorage.removeFilter(filter);
  FilterStorage.addFilter(filter, policySubscription);
  var whitelisted_string = localStorage.whitelisted || "{}";
  var whitelisted = JSON.parse(whitelisted_string);
  whitelisted[origin] = true;
  localStorage.whitelisted = JSON.stringify(whitelisted);
  teardownCookieBlocking(origin);
};

/**
 * Are there any acceptable privacy policy hashes
 * @return {boolean}
 */
function privacyHashesDoExist(){
  return !! localStorage.badgerHashes && Object.keys(JSON.parse(localStorage.badgerHashes)).length > 0;
}

/**
 * Check if a given hash is the hash of a valid privacy policy
 * @return {boolean}
 */
function isValidPolicyHash(hash){
  if (!privacyHashesDoExist()) {
    console.error('No privacy badger policy hashes in storage! Refreshing...');
    updatePrivacyPolicyHashes();
    return false;
  }

  var hashes = JSON.parse(localStorage.badgerHashes);
  for (var key in hashes) {
    if (hash === hashes[key]){ return true; }
  }
  return false;
}


/**
 * saves a user preference for an origin, overriding
 * the default setting. Also takes an optional target to only
 * override the setting for a specific first party domain
 * @param {String} userAction enum of block, cookieblock, noaction
 * @param {String} origin the third party origin to take action on
 * @param {String} target an optional first party to scope the action to
 */
function saveAction(userAction, origin, target) {
  var allUserActions = {'block': 'userRed',
                        'cookieblock': 'userYellow',
                        'noaction': 'userGreen'};
  if (target) {
    var filter = Filter.fromText("@@||" + origin + "^$third-party,domain=" + target);
    FilterStorage.addFilter(filter, FilterStorage.knownSubscriptions[allUserActions[userAction]]);
    console.log("Finished saving action " + userAction + " for " + origin + "on" + target);
    return true;
  } 

  // If there is no target proceed as normal
  for (var action in allUserActions) {
    var filter = Filter.fromText("||" + origin + "^$third-party");
    if (action == userAction) {
      console.log('adding filter', filter, 'to', action);
      FilterStorage.addFilter(filter, FilterStorage.knownSubscriptions[allUserActions[action]]);
    } else {
      console.log('removing filter', filter, 'from', action);
      FilterStorage.removeFilter(filter, FilterStorage.knownSubscriptions[allUserActions[action]]);
    }
  }
  console.log("Finished saving action " + userAction + " for " + origin);

  // TODO: right now we don't determine whether a reload is needed
  return true;
}

/**
 * reloads a tab
 * @param {Integer} tabId the chrome tab id
 */
function reloadTab(tabId){
  chrome.tabs.reload(tabId);
}

/**
 * Check if an origin is already in the heuristic
 * @param {String} origin 3rd party host
 * @return {Boolean}
 */
function isOriginInHeuristic(origin){
  var seen = JSON.parse(localStorage.getItem("seenThirdParties"));
  return seen.hasOwnProperty(getBaseDomain(origin));
}

/**
 * count of blocked origins for a given tab
 * @param {Integer} tabId chrome tab id
 * @return {Integer} count of blocked origins
 */
function blockedOriginCount(tabId){
  return getAllOriginsForTab(tabId)
    .reduce(function(memo,origin){
      if(getAction(tabId,origin)){
        memo+=1;
      }
      return memo;
    }, 0);
}

/**
 * Counts the actively blocked trackers
 *
 * @param tabId Tab ID to count for
 * @returns {Integer} The number of blocked trackers
 */
function activelyBlockedOriginCount(tabId){
  return getAllOriginsForTab(tabId)
    .reduce(function(memo,origin){
      var action = getAction(tabId,origin);
      if(action && action !== "noaction"){
        memo+=1;
      }
      return memo;
    }, 0);
}

function setTrackingFlag(tabId,fqdn){
  tabData[tabId].trackers[fqdn] = true;
}

function originHasTracking(tabId,fqdn){
  return tabData[tabId] && 
    tabData[tabId].trackers &&
    !!tabData[tabId].trackers[fqdn];
}
/**
 * Counts trackers blocked by the user
 *
 * @param tabId Tab ID to count for
 * @returns {Integer} The number of blocked trackers
 */
function userConfiguredOriginCount(tabId){
  return getAllOriginsForTab(tabId)
    .reduce(function(memo,origin){
      var action = getAction(tabId,origin);
      if(action && action.lastIndexOf("user", 0) === 0){
        memo+=1;
      }
      return memo;
    }, 0);
}

/**
 * Update page action badge with current count
 * @param {Integer} tabId chrome tab id
 */
function updateBadge(tabId){
  var numBlocked = blockedOriginCount(tabId);
  if(numBlocked === 0){
    chrome.browserAction.setBadgeBackgroundColor({tabId: tabId, color: "#00ff00"});
  } else {
    chrome.browserAction.setBadgeBackgroundColor({tabId: tabId, color: "#ff0000"});
  }
  chrome.browserAction.setBadgeText({tabId: tabId, text: numBlocked + ""});
}

/**
 * Checks conditions for updating page action badge and call updateBadge
 * @param {Object} details details object from onBeforeRequest event
 */
function updateCount(details){
  if (details.tabId == -1){
    return {};
  }

  if(!Utils.isPrivacyBadgerEnabled(getHostForTab(details.tabId))){
    return;
  }

  var tabId = details.tabId;
  if (!tabData[tabId]) {
    return;
  }
  if(tabData[tabId].bgTab === true){
    // prerendered tab, Chrome will throw error for setBadge functions, don't call
    return;
  }else if(tabData[tabId].bgTab === false){
    updateBadge(tabId);
  }else{
    chrome.tabs.get(tabId, function(tab){
      if (chrome.runtime.lastError){
        tabData[tabId].bgTab = true;
      }else{
        tabData[tabId].bgTab = false;
        updateBadge(tabId);
      }
    });
  }
}
chrome.webRequest.onBeforeRequest.addListener(updateCount, {urls: ["http://*/*", "https://*/*"]}, []);


/**
* Populate tabs object with currently open tabs when extension is updated or installed. 
*/
function updateTabList(){
  console.log('update tabs!');
  // Initialize the tabData/frames object if it is falsey
  tabData = tabData || {};
  chrome.tabs.query({currentWindow: true, status: 'complete'}, function(tabs){
    for(var i = 0; i < tabs.length; i++){
      var tab = tabs[i];
      tabData[tab.id] = {
        frames: {
          0: {
            parent: -1,
            url: tab.url
          }
        },
        domains: {}
      };
    }
  });

  CookieBlockList.updateDomains();
  BlockedDomainList.updateDomains();
  DomainExceptions.updateList();
  updatePrivacyPolicyHashes();
}

/**
 * Decide what the action would presumably be for an origin
 * used to determine where the slider should go when the undo button
 * is clicked. 
 *
 * @param string origin the domain to guess the action for
 */
function getPresumedAction(origin){
  if(BlockedDomainList.hasDomain(origin)){
    if (CookieBlockList.hasDomain(origin) ||
        CookieBlockList.hasDomain(getBaseDomain(origin))) {
      return 'cookieblock';
    } else {
      return 'block';
    }
  } else {
    return 'noaction';
  }
}
