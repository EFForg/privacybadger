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
var FirefoxAndroid = require("firefoxandroid");
var webrequest = require("webrequest");
var SocialWidgetLoader = require("socialwidgetloader");

window.SocialWidgetList = [];
SocialWidgetLoader.loadSocialWidgetsFromFile("data/socialwidgets.json", function(socialWidgets) {
  window.SocialWidgetList = socialWidgets;
});

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
      badger.initializeYellowlist();
      badger.initializeDNT();
      badger.initializeUserAllowList();
      badger.enableWebRTCProtection();
      if (!badger.isIncognito) {badger.showFirstRunPage();}
    }

    // Show icon as page action for all tabs that already exist
    chrome.tabs.query({}, function (tabs) {
      for (var i = 0; i < tabs.length; i++) {
        badger.refreshIconAndContextMenu(tabs[i]);
      }
    });

    // TODO: register all privacy badger listeners here in the storage callback

    badger.INITIALIZED = true;
  });

  /**
  * WebRTC availability check
  */
  function checkWebRTCBrowserSupport() {
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
          origins: {
            domain.tld: bool
            ...
          }
        },
        ...
      }
  */
  tabData: {},


  // Methods

  showFirstRunPage: function() {
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
    var allUserActions = {
      'block': constants.USER_BLOCK,
      'cookieblock': constants.USER_COOKIE_BLOCK,
      'allow': constants.USER_ALLOW
    };
    this.storage.setupUserAction(origin, allUserActions[userAction]);
    log("Finished saving action " + userAction + " for " + origin);

    // TODO: right now we don't determine whether a reload is needed
    return true;
  },


  /**
  * Populate tabs object with currently open tabs when extension is updated or installed.
  */
  updateTabList: function() {
    // Initialize the tabData/frames object if it is falsey
    this.tabData = this.tabData || {};
    let self = this;
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        self.recordFrame(tab.id, 0, -1, tab.url);
      });
    });
  },

  /**
   * Generate representation in internal data structure for frame
   *
   * @param tabId ID of the tab
   * @param frameId ID of the frame
   * @param parentFrameId ID of the parent frame
   * @param frameUrl The url of the frame
   */
  recordFrame: function(tabId, frameId, parentFrameId, frameUrl) {
    let self = this;

    if (!self.tabData.hasOwnProperty(tabId)) {
      self.tabData[tabId] = {
        frames: {},
        origins: {}
      };
    }

    self.tabData[tabId].frames[frameId] = {
      url: frameUrl,
      parent: parentFrameId
    };
  },

  /**
   * Initializes the yellowlist from disk, if first time initializing.
   * Then updates to the latest yellowlist from eff.org.
   * Sets up periodic yellowlist updating from eff.org.
   */
  initializeYellowlist: function () {
    let self = this,
      yellowlistStorage = self.storage.getBadgerStorageObject('cookieblock_list');

    if (!_.size(yellowlistStorage.getItemClones())) {
      // we don't have the yellowlist initialized yet
      // first initialize from disk
      utils.xhrRequest(constants.YELLOWLIST_LOCAL_URL, (error, response) => {
        if (!error) {
          self.storage.updateYellowlist(response.trim().split("\n"));
        }

        // get the latest yellowlist from eff.org
        self.updateYellowlist();
      });

    } else {
      // already got the yellowlist initialized
      // get the latest yellowlist from eff.org
      self.updateYellowlist();
    }

    // set up periodic fetching of the yellowlist from eff.org
    setInterval(self.updateYellowlist.bind(self), utils.oneDay());
  },

  /**
   * (Currently Chrome only)
   * Change default WebRTC handling browser policy to more
   * private setting that only shows public facing IP address.
   * Only update if user does not have the strictest setting enabled
   **/
  enableWebRTCProtection: function() {
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
        function() {
          settings.setItem("webRTCIPProtection", false);
        });
    });
  },

  /**
   * Updates to the latest yellowlist from eff.org.
   * @param {Function} [callback] optional callback, gets success status boolean
   */
  updateYellowlist: function (callback) {
    var self = this;

    if (!callback) {
      callback = _.noop;
    }

    utils.xhrRequest(constants.YELLOWLIST_URL, function (err, response) {
      if (err) {
        console.error(
          "Problem fetching yellowlist at",
          constants.YELLOWLIST_URL,
          err.status,
          err.message
        );

        return callback(false);
      }

      // handle empty response
      if (!response.trim()) {
        return callback(false);
      }

      var domains = response.trim().split("\n").map(domain => domain.trim());

      // validate the response
      if (!_.every(domains, (domain) => {
        // all domains must contain at least one dot
        if (domain.indexOf('.') == -1) {
          return false;
        }

        // validate character set
        //
        // regex says:
        // - domain starts with lowercase English letter or Arabic numeral
        // - following that, it contains one or more
        // letter/numeral/dot/dash characters
        // - following the previous two requirements, domain ends with a letter
        //
        // TODO both overly restrictive and inaccurate
        // but that's OK for now, we manage the list
        if (!/^[a-z0-9][a-z0-9.-]+[a-z]$/.test(domain)) {
          return false;
        }

        return true;
      })) {
        return callback(false);
      }

      self.storage.updateYellowlist(domains);

      return callback(true);
    });
  },

  /**
   * Initializes DNT policy hashes from disk, if first time initializing.
   * Then updates to the latest hashes from eff.org.
   * Sets up periodic updating of hashes from eff.org.
   */
  initializeDNT: function () {
    let self = this;

    if (!_.size(self.storage.getBadgerStorageObject('dnt_hashes').getItemClones())) {
      // we don't have DNT hashes initialized yet
      // first initialize from disk
      utils.xhrRequest(constants.DNT_POLICIES_LOCAL_URL, (error, response) => {
        if (!error) {
          self.storage.updateDNTHashes(JSON.parse(response));
        }

        // get the latest hashes from eff.org
        self.updateDNTPolicyHashes();
      });

    } else {
      // already got DNT hashes initialized
      // get the latest hashes from eff.org
      self.updateDNTPolicyHashes();
    }

    // set up periodic fetching of hashes from eff.org
    setInterval(self.updateDNTPolicyHashes.bind(self), utils.oneDay() * 4);
  },

  /**
   * Search through action_map list and update list of domains
   * that user has manually set to "allow"
   */
  initializeUserAllowList: function() {
    var action_map = this.storage.getBadgerStorageObject('action_map');
    for (var domain in action_map.getItemClones()) {
      if (this.storage.getAction(domain) === constants.USER_ALLOW) {
        this.userAllow.push(domain);
      }
    }
  },

  /**
  * Fetch acceptable DNT policy hashes from the EFF server
  */
  updateDNTPolicyHashes: function() {
    if (! badger.isCheckingDNTPolicyEnabled()) {
      // user has disabled this, we can check when they re-enable
      return ;
    }

    var self = this;
    utils.xhrRequest(constants.DNT_POLICIES_URL, function(err, response) {
      if (err) {
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
  * @param {Function} cb Callback that receives check status boolean (optional)
  */
  checkForDNTPolicy: function (domain, cb) {
    var badger = this,
      next_update = badger.storage.getNextUpdateForDomain(domain);

    if (Date.now() < next_update) {
      // not yet time
      return;
    }

    if (!badger.isCheckingDNTPolicyEnabled()) {
      // user has disabled this check
      return;
    }

    log('Checking', domain, 'for DNT policy.');

    // update timestamp first;
    // avoids queuing the same domain multiple times
    var recheckTime = _.random(
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

    utils.xhrRequest(url,function(err,response) {
      if (err) {
        callback(successStatus);
        return;
      }
      // TODO Use sha256
      utils.sha1(response, function(hash) {
        if (dnt_hashes.hasItem(hash)) {
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
  initializeDefaultSettings: function() {
    var settings = this.storage.getBadgerStorageObject("settings_map");
    _.each(this.defaultSettings, function(value, key) {
      if (!settings.hasItem(key)) {
        log("setting", key, ":", value);
        settings.setItem(key, value);
      }
    });
  },

  runMigrations: function() {
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
      Migrations.unblockIncorrectlyBlockedDomains,
      Migrations.forgetBlockedDNTDomains,
      Migrations.reapplyYellowlist,
    ];

    for (var i = migrationLevel; i < migrations.length; i++) {
      migrations[i].call(Migrations, badger);
      settings.setItem('migrationLevel', i+1);
    }

  },


  /**
   * Helper function returns a list of all third party origins for a tab
   * @param {Integer} tab_id requested tab id as provided by chrome
   * @returns {*} A dictionary of third party origins and their actions
   */
  getAllOriginsForTab: function (tab_id) {
    return (
      this.tabData.hasOwnProperty(tab_id) &&
      Object.keys(this.tabData[tab_id].origins)
    );
  },

  /**
   * Returns the count of blocked/cookieblocked origins for a tab.
   * @param {Integer} tab_id browser tab ID
   * @returns {Integer} blocked origin count
   */
  getBlockedOriginCount: function (tab_id) {
    let self = this;

    return self.getAllOriginsForTab(tab_id).reduce((memo, origin) => {
      let action = self.storage.getBestAction(origin);
      if (constants.BLOCKED_ACTIONS.has(action)) {
        memo++;
      }
      return memo;
    }, 0);
  },

  /**
   * Update page action badge with current count.
   * @param {Integer} tab_id browser tab ID
   */
  updateBadge: function (tab_id) {
    if (!FirefoxAndroid.hasBadgeSupport) {
      return;
    }

    let self = this;

    chrome.tabs.get(tab_id, function (tab) {
      if (chrome.runtime.lastError) {
        // don't set on background (prerendered) tabs to avoid Chrome errors
        return;
      }

      if (!tab.active) {
        // don't set on inactive tabs
        return;
      }

      let disabled = tab.url && self.isPrivacyBadgerDisabled(window.extractHostFromURL(tab.url));

      // don't show the counter for any of these:
      // - the counter is disabled
      // - the page is whitelisted
      // - we don't have tabData for whatever reason (special browser pages)
      if (!self.showCounter() || disabled || !self.tabData.hasOwnProperty(tab_id)) {
        chrome.browserAction.setBadgeText({tabId: tab_id, text: ""});
        return;
      }

      let count = self.getBlockedOriginCount(tab_id);

      if (count === 0) {
        chrome.browserAction.setBadgeBackgroundColor({tabId: tab_id, color: "#00cc00"});
      } else {
        chrome.browserAction.setBadgeBackgroundColor({tabId: tab_id, color: "#cc0000"});
      }

      chrome.browserAction.setBadgeText({tabId: tab_id, text: count + ""});
    });
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
  isPrivacyBadgerEnabled: function(origin) {
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    if (disabledSites && disabledSites.length > 0) {
      for (var i = 0; i < disabledSites.length; i++) {
        var site = disabledSites[i];
        if (site.startsWith("*")) {
          if (window.getBaseDomain(site) === window.getBaseDomain(origin)) {
            return false;
          }
        }
        if (disabledSites[i] === origin) {
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
  isPrivacyBadgerDisabled: function(origin) {
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
  disablePrivacyBadgerForOrigin: function(origin) {
    var settings = this.getSettings();
    var disabledSites = settings.getItem('disabledSites');
    if (disabledSites.indexOf(origin) < 0) {
      disabledSites.push(origin);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * Interface to get the current whitelisted domains
   */
  listOriginsWherePrivacyBadgerIsDisabled: function() {
    return this.getSettings().getItem("disabledSites");
  },

  /**
   * Remove an origin from the disabledSites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  enablePrivacyBadgerForOrigin: function(origin) {
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    var idx = disabledSites.indexOf(origin);
    if (idx >= 0) {
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
      if (estimatedEntropy > LOCALSTORAGE_ENTROPY_THRESHOLD) {
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
   * Save third party origins to tabData[tab_id] object for
   * use in the popup and, if needed, call updateBadge.
   *
   * @param tab_id the tab we are on
   * @param fqdn the third party origin to add
   * @param action the action we are taking
   *
   **/
  logThirdPartyOriginOnTab: function (tab_id, fqdn, action) {
    let blocked = constants.BLOCKED_ACTIONS.has(action);

    if (this.tabData[tab_id].origins.hasOwnProperty(fqdn)) {
      // we've seen this origin on this tab already
      // still want to update badge if we haven't yet seen origin as blocked
      if (blocked && !this.tabData[tab_id].origins[fqdn]) {
        // record that origin has been seen as blocked
        this.tabData[tab_id].origins[fqdn] = true;

        badger.updateBadge(tab_id);
      }
    } else {
      // haven't seen the origin on this tab yet
      this.tabData[tab_id].origins[fqdn] = blocked;

      if (blocked) {
        badger.updateBadge(tab_id);
      }
    }
  },

  /**
   * Enables or disables page action icon according to options.
   * @param {Object} tab The tab to set the badger icon for
   */
  refreshIconAndContextMenu: function (tab) {
    if (!tab || !FirefoxAndroid.hasPopupSupport) {
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
  },

};

/**************************** Listeners ****************************/

function startBackgroundListeners() {
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == "loading" && tab.url) {
      badger.refreshIconAndContextMenu(tab);
      badger.updateBadge(tabId);
    }
  });

  // Update icon if a tab is replaced or loaded from cache
  chrome.tabs.onReplaced.addListener(function(addedTabId/*, removedTabId*/) {
    chrome.tabs.get(addedTabId, function(tab) {
      badger.refreshIconAndContextMenu(tab);
    });
  });

  chrome.tabs.onActivated.addListener(function (activeInfo) {
    badger.updateBadge(activeInfo.tabId);
  });

  // Listening for Avira Autopilot remote control UI
  // The Scout browser needs a "emergency off" switch in case Privacy Badger breaks a page.
  // The Privacy Badger UI will removed from the URL bar into the menu to achieve a cleaner UI in the future.
  if (chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener(
      function(request, sender, sendResponse) {
        // This is the ID of the Avira Autopilot extension, which is the central menu for the scout browser
        if (sender.id === "ljjneligifenjndbcopdndmddfcjpcng") {
          if (request.command == "getDisabledSites") {
            sendResponse({origins: badger.listOriginsWherePrivacyBadgerIsDisabled()});
          } else if (request.command == "enable") {
            badger.enablePrivacyBadgerForOrigin(request.origin);
          } else if (request.command == "disable") {
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
FirefoxAndroid.startListeners();
startBackgroundListeners();

// TODO move listeners and this message behind INITIALIZED
console.log('Privacy badger is ready to rock!');
console.log('Set DEBUG=1 to view console messages.');
