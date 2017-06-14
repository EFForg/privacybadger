/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 *
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

/* globals log:false */

var utils = require("utils");
var constants = require("constants");
var pbStorage = require("storage");

var HeuristicBlocking = require("heuristicblocking");
var webrequest = require("webrequest");
var SocialWidgetLoader = require("socialwidgetloader");
window.SocialWidgetList = SocialWidgetLoader.loadSocialWidgetsFromFile("data/socialwidgets.json");

var Migrations = require("migrations").Migrations;
var incognito = require("incognito");

/**
* privacy badger initializer
*/
function Badger() {
  var badger = this;
  this.userAllow = [];
  this.webRTCAvailable = checkWebRTCBrowserSupport();
  this.storage = new pbStorage.BadgerPen(function(thisStorage) {
    if (badger.INITIALIZED) { return; }
    badger.heuristicBlocking = new HeuristicBlocking.HeuristicBlocker(thisStorage);
    badger.updateTabList();
    badger.initializeDefaultSettings();
    try {
      badger.runMigrations();
    } finally {
      badger.initializeCookieBlockList();
      badger.initializeDNT();
      badger.initializeUserAllowList();
      badger.enableWebRTCProtection();
      if (!badger.isIncognito) {badger.showFirstRunPage();}
    }

    // Show icon as page action for all tabs that already exist
    chrome.windows.getAll({populate: true}, function (windows) {
      for (var i = 0; i < windows.length; i++) {
        for (var j = 0; j < windows[i].tabs.length; j++) {
          badger.refreshIconAndContextMenu(windows[i].tabs[j]);
        }
      }
    });

    // TODO: register all privacy badger listeners here in the storage callback

    badger.INITIALIZED = true;
  });

  /**
  * WebRTC availability check
  */
  function checkWebRTCBrowserSupport(){
    if (!(chrome.privacy && chrome.privacy.network &&
      chrome.privacy.network.webRTCIPHandlingPolicy)) {
      return false;
    }

    var available = true;
    var connection = null;

    try {
      var RTCPeerConnection = (
        window.RTCPeerConnection || window.webkitRTCPeerConnection
      );
      if (RTCPeerConnection) {
        connection = new RTCPeerConnection(null);
      }
    } catch (ex) {
      available = false;
    }

    if (connection !== null && connection.close) {
      connection.close();
    }

    return available;
  }
}

Badger.prototype = {
  INITIALIZED: false,

  /**
  * Per-tab data that gets cleaned up on tab closing
    looks like:
      tabData = {
        <tab_id>: {
          fpData: {
            <script_origin>: {
              canvas: {
                fingerprinting: boolean,
                write: boolean
              }
            },
            ...
          },
          frames: {
            <frame_id>: {
              url: string,
              parent: int
            },
            ...
          },
          trackers: {
            domain.tld: bool
            ...
          }
        },
        ...
      }
  */
  tabData: {},


  // Methods

  showFirstRunPage: function(){
    var settings = this.storage.getBadgerStorageObject("settings_map");
    if (settings.getItem("isFirstRun") && !chrome.extension.inIncognitoContext) {
      chrome.tabs.create({
        url: chrome.extension.getURL("/skin/firstRun.html")
      });
      settings.setItem("isFirstRun", false);
    }
  },

  /**
  * saves a user preference for an origin, overriding
  * the default setting.
  * @param {String} userAction enum of block, cookieblock, noaction
  * @param {String} origin the third party origin to take action on
  */
  saveAction: function(userAction, origin) {
    var allUserActions = {'block': constants.USER_BLOCK,
                          'cookieblock': constants.USER_COOKIE_BLOCK,
                          'allow': constants.USER_ALLOW};
    this.storage.setupUserAction(origin, allUserActions[userAction]);
    log("Finished saving action " + userAction + " for " + origin);

    // TODO: right now we don't determine whether a reload is needed
    return true;
  },


  /**
  * Populate tabs object with currently open tabs when extension is updated or installed.
  */
  updateTabList: function(){
    // Initialize the tabData/frames object if it is falsey
    this.tabData = this.tabData || {};
    var self = this;
    chrome.tabs.query({currentWindow: true, status: 'complete'}, function(tabs){
      for(var i = 0; i < tabs.length; i++){
        var tab = tabs[i];
        self.tabData[tab.id] = {
          frames: {
            0: {
              parent: -1,
              url: tab.url
            }
          },
          trackers: {}
        };
      }
    });
  },

  /**
   * Initialize the Cookieblock List:
   * * Download list from eff
   * * Merge with existing cookieblock list if any
   * * Add any new domains to the action map
   * Set a timer to update every 24 hours
   **/
  initializeCookieBlockList: function(){
    this.updateCookieBlockList();
    setInterval(this.updateCookieBlockList.bind(this), utils.oneDay());
  },

  /**
   * (Currently Chrome only)
   * Change default WebRTC handling browser policy to more
   * private setting that only shows public facing IP address.
   * Only update if user does not have the strictest setting enabled
   **/
  enableWebRTCProtection: function(){
    // Return early with non-supporting browsers
    if (!badger.webRTCAvailable) {
      return;
    }

    var cpn = chrome.privacy.network;
    var settings = this.storage.getBadgerStorageObject("settings_map");

    cpn.webRTCIPHandlingPolicy.get({}, function(result) {
      if (result.value === 'disable_non_proxied_udp') {
        // TODO is there case where other extension controls this and PB
        // TODO cannot modify it?
        // Make sure we display correct setting on options page
        settings.setItem("webRTCIPProtection", true);
        return;
      }

      cpn.webRTCIPHandlingPolicy.set({ value: 'default_public_interface_only'},
          function(){
            settings.setItem("webRTCIPProtection", false);
          });
    });
  },

  /**
  * Update the cookie block list with a new list
  * add any new entries that already have a parent domain in the action_map
  * and remove any old entries that are no longer in the cookie block list
  * from the action map
  **/
  updateCookieBlockList: function(){
    var self = this;
    utils.xhrRequest(constants.COOKIE_BLOCK_LIST_URL, function(err,response){
      if(err){
        console.error('Problem fetching cookieblock list at',
                  constants.COOKIE_BLOCK_LIST_URL, err.status, err.message);
        return;
      }
      var cookieblock_list = self.storage.getBadgerStorageObject('cookieblock_list');
      var action_map = self.storage.getBadgerStorageObject('action_map');

      var newCbDomains = _.map(response.split("\n"), function(d){ return d.trim();});
      var oldCbDomains = Object.keys(cookieblock_list.getItemClones());

      var addedDomains = _.difference(newCbDomains, oldCbDomains);
      var removedDomains = _.difference(oldCbDomains, newCbDomains);
      log('adding to cookie blocklist:', addedDomains);
      log('removing from cookie blocklist:', removedDomains);

      // Change any removed domains back to blocked status
      _.each(removedDomains, function(domain){
        cookieblock_list.deleteItem(domain);
        if(action_map.hasItem(domain)){
          self.storage.setupHeuristicAction(domain, constants.BLOCK);
        }
        var rmvdSubdomains = _.filter(Object.keys(action_map.getItemClones()),
                                  function(subdomain){
                                    return subdomain.endsWith(domain);
                                  });
        _.each(rmvdSubdomains, function(subDomain){
          self.storage.setupHeuristicAction(subDomain, constants.BLOCK);
        });
      });

      // Add any new cookie block domains who's parent domain is already blocked
      _.each(addedDomains, function(domain){
        cookieblock_list.setItem(domain, true);
        var baseDomain = window.getBaseDomain(domain);
        if(action_map.hasItem(baseDomain) &&
           _.contains([constants.BLOCK, constants.COOKIEBLOCK],
                      action_map.getItem(baseDomain).heuristicAction)){
          self.storage.setupHeuristicAction(domain, constants.COOKIEBLOCK);
        }
      });

    });
  },

  /**
  * Initialize DNT policy subsystem by downloading acceptable hashes from EFF
  */
  initializeDNT: function () {
    this.updateDNTPolicyHashes();
    setInterval(this.updateDNTPolicyHashes.bind(this), utils.oneDay() * 4);
  },

  /**
   * Search through action_map list and update list of domains
   * that user has manually set to "allow"
   */
  initializeUserAllowList: function() {
    var action_map = this.storage.getBadgerStorageObject('action_map');
    for(var domain in action_map.getItemClones()){
      if(this.storage.getAction(domain) === constants.USER_ALLOW){
        this.userAllow.push(domain);
      }
    }
  },

  /**
  * Fetch acceptable DNT policy hashes from the EFF server
  */
  updateDNTPolicyHashes: function(){
    if (! badger.isCheckingDNTPolicyEnabled()) {
      // user has disabled this, we can check when they re-enable
      return ;
    }

    var self = this;
    utils.xhrRequest(constants.DNT_POLICIES_URL, function(err,response){
      if(err){
        console.error('Problem fetching DNT policy hash list at',
                 constants.DNT_POLICIES_URL, err.status, err.message);
        return;
      }
      self.storage.updateDNTHashes(JSON.parse(response));
    });
  },

  /**
  * Checks a domain for the EFF DNT policy.
  *
  * @param {String} domain The domain to check
  * @param {timestamp} nextUpdate Time when the DNT policy should be rechecked
  * @param {Function} cb Callback that receives check status boolean (optional)
  */
  checkForDNTPolicy: function (domain, nextUpdate, cb) {
    if (Date.now() < nextUpdate) {
      // not yet time
      return;
    }

    var badger = this;

    if (! badger.isCheckingDNTPolicyEnabled()) {
      // user has disabled this check
      return ;
    }

    log('Checking', domain, 'for DNT policy.');

    // update timestamp first;
    // avoids queuing the same domain multiple times
    var recheckTime = utils.getRandom(
      utils.oneDayFromNow(),
      utils.nDaysFromNow(7)
    );
    badger.storage.touchDNTRecheckTime(domain, recheckTime);

    this._checkPrivacyBadgerPolicy(domain, function (success) {
      if (success) {
        log('It looks like', domain, 'has adopted Do Not Track! I am going to unblock them');
        badger.storage.setupDNT(domain);
      } else {
        log('It looks like', domain, 'has NOT adopted Do Not Track');
        badger.storage.revertDNT(domain);
      }
      if (typeof cb == "function") {
        cb(success);
      }
    });
  },


  /**
  * Asyncronously checks if the domain has /.well-known/dnt-policy.txt.
  *
  * Rate-limited to at least one second apart.
  *
  * @param {String} origin The host to check
  * @param {Function} callback callback(successStatus)
  */
  _checkPrivacyBadgerPolicy: utils.rateLimit(function (origin, callback) {
    var successStatus = false;
    var url = "https://" + origin + "/.well-known/dnt-policy.txt";
    var dnt_hashes = this.storage.getBadgerStorageObject('dnt_hashes');

    utils.xhrRequest(url,function(err,response){
      if(err){
        callback(successStatus);
        return;
      }
      // TODO Use sha256
      utils.sha1(response, function(hash) {
        if(dnt_hashes.hasItem(hash)){
          successStatus = true;
        }
        callback(successStatus);
      });
    });
  }, constants.DNT_POLICY_CHECK_INTERVAL),

  /**
   * Default privacy badger settings
   */
  defaultSettings: {
    checkForDNTPolicy: true,
    disabledSites: [],
    isFirstRun: true,
    migrationLevel: 0,
    seenComic: false,
    showCounter: true,
    socialWidgetReplacementEnabled: true,
  },

  /**
   * initialize default settings if nonexistent
   */
  initializeDefaultSettings: function(){
    var settings = this.storage.getBadgerStorageObject("settings_map");
    _.each(this.defaultSettings, function(value, key){
      if(!settings.hasItem(key)){
        log("setting", key, ":", value);
        settings.setItem(key, value);
      }
    });
  },

  runMigrations: function(){
    var badger = this;
    var settings = badger.storage.getBadgerStorageObject("settings_map");
    var migrationLevel = settings.getItem('migrationLevel');
    // TODO do not remove any migration methods
    // TODO w/o refactoring migrationLevel handling to work differently
    var migrations = [
      Migrations.changePrivacySettings,
      Migrations.migrateAbpToStorage,
      Migrations.migrateBlockedSubdomainsToCookieblock,
      Migrations.migrateLegacyFirefoxData,
      Migrations.migrateDntRecheckTimes,
      // Need to run this migration again for everyone to #1181
      Migrations.migrateDntRecheckTimes2,
      Migrations.forgetMistakenlyBlockedDomains,
    ];

    for (var i = migrationLevel; i < migrations.length; i++) {
      migrations[i].call(Migrations, badger);
      settings.setItem('migrationLevel', i+1);
    }

  },


/**
   * Helper function returns a list of all blocked origins for a tab
   * @param {Integer} tabId requested tab id as provided by chrome
   * @returns {*} A dictionary of third party origins and their actions
   */
  getAllOriginsForTab: function(tabId) {
    return Object.keys(this.tabData[tabId].trackers);
  },

  /**
   * count of blocked origins for a given tab
   * @param {Integer} tabId chrome tab id
   * @return {Integer} count of blocked origins
   */
  blockedOriginCount: function(tabId) {
    return this.getAllOriginsForTab(tabId).length;
  },

  /**
   * Counts total blocked trackers and blocked cookies trackers
   * TODO: ugly code, refactor
   *
   * @param tabId Tab ID to count for
   * @returns {Integer} The sum of blocked trackers and cookie blocked trackers
   */
  blockedTrackerCount: function(tabId){
    var self = this;
    return self.getAllOriginsForTab(tabId)
      .reduce(function(memo,origin){
        var action = self.storage.getBestAction(origin);
        if(action && (action == constants.USER_BLOCK || action ==
                    constants.BLOCK || action == constants.COOKIEBLOCK ||
                    action == constants.USER_COOKIE_BLOCK)){
          memo+=1;
        }
        return memo;
      }, 0);
  },

  /**
   * Update page action badge with current count
   * @param {Integer} tabId chrome tab id
   */
  updateBadge: function(tabId){
    if (!this.showCounter()){
      chrome.browserAction.setBadgeText({tabId: tabId, text: ""});
      return;
    }
    var numBlocked = this.blockedTrackerCount(tabId);
    if(numBlocked === 0){
      chrome.browserAction.setBadgeBackgroundColor({tabId: tabId, color: "#00cc00"});
    } else {
      chrome.browserAction.setBadgeBackgroundColor({tabId: tabId, color: "#cc0000"});
    }
    chrome.browserAction.setBadgeText({tabId: tabId, text: numBlocked + ""});
  },

  /**
   * Checks conditions for updating page action badge and call updateBadge
   * @param {Object} details details object from onBeforeRequest event
   */
  updateCount: function(details) {
    if(!this.isPrivacyBadgerEnabled(webrequest.getHostForTab(details.tabId))){
      return;
    }

    var tabId = details.tabId;
    if (!this.tabData[tabId]) {
      return;
    }
    if(this.tabData[tabId].bgTab === true){
      // prerendered tab, Chrome will throw error for setBadge functions, don't call
      return;
    } else {
      var badger = this;
      chrome.tabs.get(tabId, function(/*tab*/){
        if (chrome.runtime.lastError){
          badger.tabData[tabId].bgTab = true;
        } else {
          badger.tabData[tabId].bgTab = false;
          badger.updateBadge(tabId);
        }
      });
    }
  },

  getSettings: function() {
    return this.storage.getBadgerStorageObject('settings_map');
  },

  /**
   * Check if privacy badger is enabled, take an origin and
   * check against the disabledSites list
   *
   * @param {String} origin
   * @returns {Boolean} true if enabled
   **/
  isPrivacyBadgerEnabled: function(origin){
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    if(disabledSites && disabledSites.length > 0){
      for(var i = 0; i < disabledSites.length; i++){
        var site = disabledSites[i];
        if(site.startsWith("*")){
          if(window.getBaseDomain(site) === window.getBaseDomain(origin)){
            return false;
          }
        }
        if(disabledSites[i] === origin){
          return false;
        }
      }
    }
    return true;
  },
  
  /**
   * Check if privacy badger is disabled, take an origin and
   * check against the disabledSites list
   *
   * @param {String} origin
   * @returns {Boolean} true if disabled
   **/
  isPrivacyBadgerDisabled: function(origin){
    return !this.isPrivacyBadgerEnabled(origin);
  },

  /**
   * Check if social widget replacement functionality is enabled
   */
  isSocialWidgetReplacementEnabled: function() {
    return this.getSettings().getItem("socialWidgetReplacementEnabled");
  },

  isCheckingDNTPolicyEnabled: function() {
    return this.getSettings().getItem("checkForDNTPolicy");
  },

  /**
   * Check if WebRTC IP leak protection is enabled; query Chrome's internal
   * value, update our local setting if it has gone out of sync, then return our
   * setting's value.
   */
  isWebRTCIPProtectionEnabled: function() {
    var self = this;

    // Return early with non-supporting browsers
    if (!badger.webRTCAvailable) {
      return;
    }

    chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function(result) {
      self.getSettings().setItem("webRTCIPProtection",
          (result.value === "disable_non_proxied_udp"));
    });
    return this.getSettings().getItem("webRTCIPProtection");
  },

  /**
   * Check if we should show the counter on the icon
   */
  showCounter: function() {
    return this.getSettings().getItem("showCounter");
  },

  /**
   * Add an origin to the disabled sites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  disablePrivacyBadgerForOrigin: function(origin){
    var settings = this.getSettings();
    var disabledSites = settings.getItem('disabledSites');
    if(disabledSites.indexOf(origin) < 0){
      disabledSites.push(origin);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * Interface to get the current whitelisted domains
   */
  listOriginsWherePrivacyBadgerIsDisabled: function(){
    return this.getSettings().getItem("disabledSites");
  },

  /**
   * Remove an origin from the disabledSites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  enablePrivacyBadgerForOrigin: function(origin){
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    var idx = disabledSites.indexOf(origin);
    if(idx >= 0){
      utils.removeElementFromArray(disabledSites, idx);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * Checks if local storage ( in dict) has any high-entropy keys
   *
   * @param lsItems Local storage dict
   * @returns {boolean} true if it seems there are supercookies
   */
  hasLocalStorageSuperCookie: function(lsItems) {
    var LOCALSTORAGE_ENTROPY_THRESHOLD = 33, // in bits
      estimatedEntropy = 0,
      lsKey = "",
      lsItem = "";
    for (lsKey in lsItems) {
      // send both key and value to entropy estimation
      lsItem = lsItems[lsKey];
      log("Checking localstorage item", lsKey, lsItem);
      estimatedEntropy += utils.estimateMaxEntropy(lsKey + lsItem);
      if (estimatedEntropy > LOCALSTORAGE_ENTROPY_THRESHOLD){
        log("Found hi-entropy localStorage: ", estimatedEntropy, " bits, key: ", lsKey);
        return true;
      }
    }
    return false;
  },

  /**
   * check if there seems to be any type of Super Cookie
   *
   * @param storageItems Dict with storage items
   * @returns {*} true if there seems to be any Super cookie
   */
  hasSuperCookie: function(storageItems) {
    return (
      this.hasLocalStorageSuperCookie(storageItems.localStorageItems)
      // || Utils.hasLocalStorageSuperCookie(storageItems.indexedDBItems)
      // || Utils.hasLocalStorageSuperCookie(storageItems.fileSystemAPIItems)
      // TODO: Do we need separate functions for other supercookie vectors?
      // Let's wait until we implement them in the content script
    );
  },

  /**
   * Add the tracker and action to the tab.trackers object in tabData
   * which will be used by the privacy badger popup
   * @param tabId the tab we are on
   * @param fqdn the tracker to add
   * @param action the action we are taking
   **/
  logTrackerOnTab: function(tabId, fqdn, action) {
    this.tabData[tabId].trackers[fqdn] = action;
  },

  /**
   * Enables or disables page action icon according to options.
   * @param {Object} tab The tab to set the badger icon for
   */
  refreshIconAndContextMenu: function (tab) {
    if (!tab) {
      return;
    }

    let iconFilename;
    if (this.isPrivacyBadgerEnabled(window.extractHostFromURL(tab.url))) {
      iconFilename = {
        "19": chrome.runtime.getURL("icons/badger-19.png"),
        "38": chrome.runtime.getURL("icons/badger-38.png")
      };
    } else {
      iconFilename = {
        "19": chrome.runtime.getURL("icons/badger-19-disabled.png"),
        "38": chrome.runtime.getURL("icons/badger-38-disabled.png")
      };
    }

    chrome.browserAction.setIcon({tabId: tab.id, path: iconFilename});
    chrome.browserAction.setTitle({tabId: tab.id, title: "Privacy Badger"});
  },

};

/**************************** Listeners ****************************/

function startBackgroundListeners() {
  chrome.webRequest.onBeforeRequest.addListener(function(details) {
    if (details.tabId != -1){
      badger.updateCount(details);
    }
  }, {urls: ["http://*/*", "https://*/*"]}, []);


  // Update icon if a tab changes location
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(changeInfo.status == "loading") {
      badger.refreshIconAndContextMenu(tab);
    }
  });

  // Update icon if a tab is replaced or loaded from cache
  chrome.tabs.onReplaced.addListener(function(addedTabId/*, removedTabId*/){
    chrome.tabs.get(addedTabId, function(tab){
      badger.refreshIconAndContextMenu(tab);
    });
  });

  // Listening for Avira Autopilot remote control UI
  // The Scout browser needs a "emergency off" switch in case Privacy Badger breaks a page.
  // The Privacy Badger UI will removed from the URL bar into the menu to achieve a cleaner UI in the future.
  if(chrome.runtime.onMessageExternal){
    chrome.runtime.onMessageExternal.addListener(
      function(request, sender, sendResponse) {
        // This is the ID of the Avira Autopilot extension, which is the central menu for the scout browser
        if (sender.id === "ljjneligifenjndbcopdndmddfcjpcng") {
          if (request.command == "getDisabledSites") {
            sendResponse({origins: badger.listOriginsWherePrivacyBadgerIsDisabled()});
          }
          else if (request.command == "enable") {
            badger.enablePrivacyBadgerForOrigin(request.origin);
          }
          else if (request.command == "disable") {
            badger.disablePrivacyBadgerForOrigin(request.origin);
          }
        }
      }
    );
  }
}

/**
 * lets get this party started
 */
console.log('Loading badgers into the pen.');
var badger = window.badger = new Badger();

/**
* Start all the listeners
*/
incognito.startListeners();
webrequest.startListeners();
HeuristicBlocking.startListeners();
startBackgroundListeners();

console.log('Privacy badger is ready to rock!');
console.log('Set DEBUG=1 to view console messages.');
