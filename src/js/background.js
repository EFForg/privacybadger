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
var widgetLoader = require("widgetloader");

var Migrations = require("migrations").Migrations;
var incognito = require("incognito");

/**
 * Privacy Badger initializer.
 */
function Badger() {
  let self = this;

  self.webRTCAvailable = checkWebRTCBrowserSupport();
  self.firstPartyDomainPotentiallyRequired = testCookiesFirstPartyDomain();
  self.setPrivacyOverrides();

  self.widgetList = [];
  widgetLoader.loadWidgetsFromFile("data/socialwidgets.json", (response) => {
    self.widgetList = response;
  });

  self.storage = new pbStorage.BadgerPen(async function (thisStorage) {
    self.initializeDefaultSettings();
    self.heuristicBlocking = new HeuristicBlocking.HeuristicBlocker(thisStorage);

    // TODO there are async migrations
    // TODO is this the right place for migrations?
    self.runMigrations();

    // kick off async initialization steps
    let seedDataPromise = self.loadFirstRunSeedData().catch(console.error),
      ylistPromise = self.initializeYellowlist().catch(console.error),
      dntHashesPromise = self.initializeDnt().catch(console.error),
      tabDataPromise = self.updateTabList().catch(console.error);

    // set badge text color to white in Firefox 63+
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1474110
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1424620
    if (chrome.browserAction.hasOwnProperty('setBadgeTextColor')) {
      chrome.browserAction.setBadgeTextColor({ color: "#fff" });
    }

    // Show icon as page action for all tabs that already exist
    chrome.tabs.query({}, function (tabs) {
      for (let i = 0; i < tabs.length; i++) {
        let tab = tabs[i];
        self.updateIcon(tab.id, tab.url);
      }
    });

    // wait for async functions (seed data, yellowlist, ...) to resolve
    await seedDataPromise;
    await ylistPromise;
    await dntHashesPromise;
    await tabDataPromise;

    // start the listeners
    incognito.startListeners();
    webrequest.startListeners();
    HeuristicBlocking.startListeners();
    FirefoxAndroid.startListeners();
    startBackgroundListeners();

    console.log("Privacy Badger is ready to rock!");
    console.log("Set DEBUG=1 to view console messages.");
    self.INITIALIZED = true;

    // get the latest yellowlist from eff.org
    self.updateYellowlist(err => {
      if (err) {
        console.error(err);
      }
    });
    // set up periodic fetching of the yellowlist from eff.org
    setInterval(self.updateYellowlist.bind(self), utils.oneDay());

    // get the latest DNT policy hashes from eff.org
    self.updateDntPolicyHashes(err => {
      if (err) {
        console.error(err);
      }
    });
    // set up periodic fetching of hashes from eff.org
    setInterval(self.updateDntPolicyHashes.bind(self), utils.oneDay() * 4);

    self.showFirstRunPage();
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

  /**
   * Checks for availability of firstPartyDomain chrome.cookies API parameter.
   * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies/getAll#Parameters
   *
   * firstPartyDomain is required when privacy.websites.firstPartyIsolate is enabled,
   * and is in Firefox since Firefox 59. (firstPartyIsolate is in Firefox since 58).
   *
   * We don't care whether firstPartyIsolate is enabled, but rather whether
   * firstPartyDomain is supported. Assuming firstPartyDomain is supported,
   * setting it to null in chrome.cookies.getAll() produces the same result
   * regardless of the state of firstPartyIsolate.
   *
   * firstPartyDomain is not currently supported in Chrome.
   */
  function testCookiesFirstPartyDomain() {
    try {
      chrome.cookies.getAll({
        firstPartyDomain: null
      }, function () {});
    } catch (ex) {
      return false;
    }
    return true;
  }

}

Badger.prototype = {
  INITIALIZED: false,

  /**
   * Per-tab data that gets cleaned up on tab closing looks like:
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
              host: string,
              parent: int
            },
            ...
          },
          origins: {
            domain.tld: {String} action taken for this domain
            ...
          }
        },
        ...
      }
   */
  tabData: {},


  // Methods

  /**
   * Sets various browser privacy overrides.
   */
  setPrivacyOverrides: function () {
    if (!chrome.privacy) {
      return;
    }

    /**
     * Sets a browser setting if Privacy Badger is allowed to set it.
     */
    function _set_override(name, api, value) {
      if (!api) {
        return;
      }
      api.get({}, result => {
        if (result.levelOfControl != "controllable_by_this_extension") {
          return;
        }
        api.set({
          value,
          scope: 'regular'
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Privacy setting failed:", chrome.runtime.lastError);
          } else {
            console.log("Set", name, "to", value);
          }
        });
      });
    }

    if (chrome.privacy.services) {
      _set_override(
        "alternateErrorPagesEnabled",
        chrome.privacy.services.alternateErrorPagesEnabled,
        false
      );
    }

    if (chrome.privacy.websites) {
      _set_override(
        "hyperlinkAuditingEnabled",
        chrome.privacy.websites.hyperlinkAuditingEnabled,
        false
      );
    }
  },

  /**
   * Loads seed dataset with pre-trained action and snitch maps.
   * @param {Function} cb callback
   */
  loadSeedData: function (cb) {
    let self = this;

    utils.xhrRequest(constants.SEED_DATA_LOCAL_URL, function (err, response) {
      if (err) {
        return cb(new Error("Failed to fetch seed data"));
      }

      let data;
      try {
        data = JSON.parse(response);
      } catch (e) {
        console.error(e);
        return cb(new Error("Failed to parse seed data JSON"));
      }

      self.mergeUserData(data, true);
      log("Loaded seed data successfully");
      return cb(null);
    });
  },

  /**
   * Loads seed data upon first run.
   *
   * @returns {Promise}
   */
  loadFirstRunSeedData: function () {
    let self = this;

    return new Promise(function (resolve, reject) {
      if (!self.getSettings().getItem("isFirstRun")) {
        log("No need to load seed data");
        return resolve();
      }

      self.loadSeedData(err => {
        log("Seed data loaded! (err=%o)", err);
        return (err ? reject(err) : resolve());
      });
    });
  },

  showFirstRunPage: function() {
    let settings = this.getSettings();
    if (settings.getItem("isFirstRun")) {
      // launch the new user intro page and unset first-run flag
      if (settings.getItem("showIntroPage")) {
        chrome.tabs.create({
          url: chrome.runtime.getURL("/skin/firstRun.html")
        });
      } else {
        // don't remind users to look at the intro page either
        settings.setItem("seenComic", true);
      }
      settings.setItem("isFirstRun", false);
    }
  },

  /**
   * Saves a user preference for an origin, overriding the default setting.
   *
   * @param {String} userAction enum of block, cookieblock, noaction
   * @param {String} origin the third party origin to take action on
   */
  saveAction: function(userAction, origin) {
    var allUserActions = {
      block: constants.USER_BLOCK,
      cookieblock: constants.USER_COOKIEBLOCK,
      allow: constants.USER_ALLOW
    };
    this.storage.setupUserAction(origin, allUserActions[userAction]);
    log("Finished saving action " + userAction + " for " + origin);
  },

  /**
   * Populate tabs object with currently open tabs when extension is updated or installed.
   *
   * @returns {Promise}
   */
  updateTabList: function () {
    let self = this;

    return new Promise(function (resolve) {
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          // don't record on special browser pages
          if (!utils.isRestrictedUrl(tab.url)) {
            self.recordFrame(tab.id, 0, tab.url);
          }
        });
        resolve();
      });
    });
  },

  /**
   * Generate representation in internal data structure for frame
   *
   * @param {Integer} tabId ID of the tab
   * @param {Integer} frameId ID of the frame
   * @param {String} frameUrl The url of the frame
   */
  recordFrame: function(tabId, frameId, frameUrl) {
    let self = this;

    if (!self.tabData.hasOwnProperty(tabId)) {
      self.tabData[tabId] = {
        frames: {},
        origins: {}
      };
    }

    self.tabData[tabId].frames[frameId] = {
      url: frameUrl,
      host: window.extractHostFromURL(frameUrl)
    };
  },

  /**
   * Read the frame data from memory
   *
   * @param {Integer} tab_id Tab ID to check for
   * @param {Integer} [frame_id=0] Frame ID to check for.
   *  Optional, defaults to frame 0 (the main document frame).
   *
   * @returns {?Object} Frame data object or null
   */
  getFrameData: function (tab_id, frame_id) {
    let self = this;

    frame_id = frame_id || 0;

    if (self.tabData.hasOwnProperty(tab_id)) {
      if (self.tabData[tab_id].frames.hasOwnProperty(frame_id)) {
        return self.tabData[tab_id].frames[frame_id];
      }
    }
    return null;
  },

  /**
   * Initializes the yellowlist from disk.
   *
   * @returns {Promise}
   */
  initializeYellowlist: function () {
    let self = this;

    return new Promise(function (resolve, reject) {

      if (self.storage.getBadgerStorageObject('cookieblock_list').keys().length) {
        log("Yellowlist already initialized from disk");
        return resolve();
      }

      // we don't have the yellowlist initialized yet
      // initialize from disk
      utils.xhrRequest(constants.YELLOWLIST_LOCAL_URL, (error, response) => {
        if (error) {
          console.error(error);
          return reject(new Error("Failed to fetch local yellowlist"));
        }

        self.storage.updateYellowlist(response.trim().split("\n"));
        log("Initialized ylist from disk");
        return resolve();
      });

    });
  },

  /**
   * Updates to the latest yellowlist from eff.org.
   * @param {Function} [callback] optional callback
   */
  updateYellowlist: function (callback) {
    let self = this;

    if (!callback) {
      callback = function () {};
    }

    utils.xhrRequest(constants.YELLOWLIST_URL, function (err, response) {
      if (err) {
        console.error(
          "Problem fetching yellowlist at",
          constants.YELLOWLIST_URL,
          err.status,
          err.message
        );

        return callback(new Error("Failed to fetch remote yellowlist"));
      }

      // handle empty response
      if (!response.trim()) {
        return callback(new Error("Empty yellowlist response"));
      }

      let domains = response.trim().split("\n").map(domain => domain.trim());

      // validate the response
      if (!domains.every(domain => {
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
        return callback(new Error("Invalid yellowlist response"));
      }

      self.storage.updateYellowlist(domains);
      log("Updated yellowlist from remote");

      return callback(null);
    });
  },

  /**
   * Initializes DNT policy hashes from disk.
   *
   * @returns {Promise}
   */
  initializeDnt: function () {
    let self = this;

    return new Promise(function (resolve, reject) {

      if (self.storage.getBadgerStorageObject('dnt_hashes').keys().length) {
        log("DNT hashes already initialized from disk");
        return resolve();
      }

      // we don't have DNT hashes initialized yet
      // initialize from disk
      utils.xhrRequest(constants.DNT_POLICIES_LOCAL_URL, (error, response) => {
        let hashes;

        if (error) {
          console.error(error);
          return reject(new Error("Failed to fetch local DNT hashes"));
        }

        try {
          hashes = JSON.parse(response);
        } catch (e) {
          console.error(e);
          return reject(new Error("Failed to parse DNT hashes JSON"));
        }

        self.storage.updateDntHashes(hashes);
        log("Initialized hashes from disk");
        return resolve();

      });

    });
  },

  /**
   * Fetch acceptable DNT policy hashes from the EFF server
   * @param {Function} [cb] optional callback
   */
  updateDntPolicyHashes: function (cb) {
    let self = this;

    if (!cb) {
      cb = function () {};
    }

    if (!self.isCheckingDNTPolicyEnabled()) {
      // user has disabled this, we can check when they re-enable
      setTimeout(function () {
        return cb(null);
      }, 0);
    }

    utils.xhrRequest(constants.DNT_POLICIES_URL, function (err, response) {
      if (err) {
        console.error("Problem fetching DNT policy hash list at",
          constants.DNT_POLICIES_URL, err.status, err.message);
        return cb(new Error("Failed to fetch remote DNT hashes"));
      }

      let hashes;
      try {
        hashes = JSON.parse(response);
      } catch (e) {
        console.error(e);
        return cb(new Error("Failed to parse DNT hashes JSON"));
      }

      self.storage.updateDntHashes(hashes);
      log("Updated hashes from remote");
      return cb(null);
    });
  },

  /**
   * Checks a domain for the EFF DNT policy.
   *
   * @param {String} domain The domain to check
   * @param {Function} [cb] Callback that receives check status boolean (optional)
   */
  checkForDNTPolicy: function (domain, cb) {
    var self = this,
      next_update = self.storage.getNextUpdateForDomain(domain);

    if (Date.now() < next_update) {
      // not yet time
      return;
    }

    if (!self.isCheckingDNTPolicyEnabled()) {
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
    self.storage.touchDNTRecheckTime(domain, recheckTime);

    self._checkPrivacyBadgerPolicy(domain, function (success) {
      if (success) {
        log('It looks like', domain, 'has adopted Do Not Track! I am going to unblock them');
        self.storage.setupDNT(domain);
      } else {
        log('It looks like', domain, 'has NOT adopted Do Not Track');
        self.storage.revertDNT(domain);
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
      utils.sha1(response, function(hash) {
        if (dnt_hashes.hasItem(hash)) {
          successStatus = true;
        }
        callback(successStatus);
      });
    });
  }, constants.DNT_POLICY_CHECK_INTERVAL),

  /**
   * Default Privacy Badger settings
   */
  defaultSettings: {
    checkForDNTPolicy: true,
    disabledSites: [],
    hideBlockedElements: true,
    isFirstRun: true,
    learnInIncognito: false,
    migrationLevel: 0,
    seenComic: false,
    sendDNTSignal: true,
    showCounter: true,
    showIntroPage: true,
    showNonTrackingDomains: false,
    showTrackingDomains: false,
    socialWidgetReplacementEnabled: true,
    widgetReplacementExceptions: [],
    widgetSiteAllowlist: {},
  },

  /**
   * initialize default settings if nonexistent
   */
  initializeDefaultSettings: function () {
    let self = this,
      settings = self.getSettings();

    for (let key in self.defaultSettings) {
      if (!self.defaultSettings.hasOwnProperty(key)) {
        continue;
      }
      if (!settings.hasItem(key)) {
        let value = self.defaultSettings[key];
        log("setting", key, "=", value);
        settings.setItem(key, value);
      }
    }
  },

  runMigrations: function() {
    var self = this;
    var settings = self.getSettings();
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
      Migrations.forgetNontrackingDomains,
      Migrations.forgetMistakenlyBlockedDomains,
      Migrations.resetWebRTCIPHandlingPolicy,
      Migrations.enableShowNonTrackingDomains,
      Migrations.forgetFirstPartySnitches,
      Migrations.forgetCloudflare,
      Migrations.forgetConsensu,
      Migrations.resetWebRTCIPHandlingPolicy2,
    ];

    for (var i = migrationLevel; i < migrations.length; i++) {
      migrations[i].call(Migrations, self);
      settings.setItem('migrationLevel', i+1);
    }

  },

  /**
   * Returns the count of tracking domains for a tab.
   * @param {Integer} tab_id browser tab ID
   * @returns {Integer} tracking domains count
   */
  getTrackerCount: function (tab_id) {
    let origins = this.tabData[tab_id].origins,
      count = 0;

    for (let domain in origins) {
      let action = origins[domain];
      if (action != constants.NO_TRACKING && action != constants.DNT) {
        count++;
      }
    }

    return count;
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

      if (self.criticalError) {
        chrome.browserAction.setBadgeBackgroundColor({tabId: tab_id, color: "#cc0000"});
        chrome.browserAction.setBadgeText({tabId: tab_id, text: "!"});
        return;
      }

      // don't show the counter for any of these:
      // - the counter is disabled
      // - we don't have tabData for whatever reason (special browser pages)
      // - Privacy Badger is disabled on the page
      if (
        !self.showCounter() ||
        !self.tabData.hasOwnProperty(tab_id) ||
        !self.isPrivacyBadgerEnabled(self.getFrameData(tab_id).host)
      ) {
        chrome.browserAction.setBadgeText({tabId: tab_id, text: ""});
        return;
      }

      let count = self.getTrackerCount(tab_id);

      if (count === 0) {
        chrome.browserAction.setBadgeText({tabId: tab_id, text: ""});
        return;
      }

      chrome.browserAction.setBadgeBackgroundColor({tabId: tab_id, color: "#ec9329"});
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
   * @param {String} origin the origin to check
   * @returns {Boolean} true if enabled
   */
  isPrivacyBadgerEnabled: function(origin) {
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    if (disabledSites && disabledSites.length > 0) {
      for (var i = 0; i < disabledSites.length; i++) {
        var site = disabledSites[i];

        if (site.startsWith("*")) {
          var wildcard = site.slice(1); // remove "*"

          if (origin.endsWith(wildcard)) {
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
   * Check if widget replacement functionality is enabled.
   */
  isWidgetReplacementEnabled: function () {
    return this.getSettings().getItem("socialWidgetReplacementEnabled");
  },

  isDNTSignalEnabled: function() {
    return this.getSettings().getItem("sendDNTSignal");
  },

  isCheckingDNTPolicyEnabled: function() {
    return this.getSettings().getItem("checkForDNTPolicy");
  },

  /**
   * Check if learning about trackers in incognito windows is enabled
   */
  isLearnInIncognitoEnabled: function() {
    return this.getSettings().getItem("learnInIncognito");
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
   */
  disablePrivacyBadgerForOrigin: function(origin) {
    var settings = this.getSettings();
    var disabledSites = settings.getItem('disabledSites');
    if (disabledSites.indexOf(origin) < 0) {
      disabledSites.push(origin);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * Returns the current list of disabled sites.
   *
   * @returns {Array} site domains where Privacy Badger is disabled
   */
  getDisabledSites: function () {
    return this.getSettings().getItem("disabledSites");
  },

  /**
   * Remove an origin from the disabledSites list
   *
   * @param {String} origin The origin to disable the PB for
   */
  enablePrivacyBadgerForOrigin: function(origin) {
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    var idx = disabledSites.indexOf(origin);
    if (idx >= 0) {
      disabledSites.splice(idx, 1);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * Checks if local storage ( in dict) has any high-entropy keys
   *
   * @param {Object} lsItems Local storage dict
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
        log("Found high-entropy localStorage: ", estimatedEntropy,
          " bits, key: ", lsKey);
        return true;
      }
    }
    return false;
  },

  /**
   * check if there seems to be any type of Super Cookie
   *
   * @param {Object} storageItems Dict with storage items
   * @returns {Boolean} true if there seems to be any Super cookie
   */
  hasSuperCookie: function(storageItems) {
    return (
      this.hasLocalStorageSuperCookie(storageItems.localStorageItems)
      //|| this.hasLocalStorageSuperCookie(storageItems.indexedDBItems)
      // TODO: See "Reading a directory's contents" on
      // http://www.html5rocks.com/en/tutorials/file/filesystem/
      //|| this.hasLocalStorageSuperCookie(storageItems.fileSystemAPIItems)
    );
  },

  /**
   * Save third party origins to tabData[tab_id] object for
   * use in the popup and, if needed, call updateBadge.
   *
   * @param {Integer} tab_id the tab we are on
   * @param {String} fqdn the third party origin to add
   * @param {String} action the action we are taking
   */
  logThirdPartyOriginOnTab: function (tab_id, fqdn, action) {
    let self = this,
      is_tracking = (
        action != constants.NO_TRACKING && action != constants.DNT
      ),
      origins = self.tabData[tab_id].origins,
      previously_tracking = origins.hasOwnProperty(fqdn) && (
        origins[fqdn] != constants.NO_TRACKING && origins[fqdn] != constants.DNT
      );

    origins[fqdn] = action;

    // no need to update badge if not a tracking domain,
    // or if we have already seen it as a tracking domain
    if (!is_tracking || previously_tracking) {
      return;
    }

    // don't block critical code paths on updating the badge
    setTimeout(function () {
      self.updateBadge(tab_id);
    }, 0);
  },

  /**
   * Enables or disables page action icon according to options.
   * @param {Integer} tab_id The tab ID to set the badger icon for
   * @param {String} tab_url The tab URL to set the badger icon for
   */
  updateIcon: function (tab_id, tab_url) {
    if (!tab_id || !tab_url || !FirefoxAndroid.hasPopupSupport) {
      return;
    }

    let self = this, iconFilename;

    // TODO grab hostname from tabData instead
    if (!utils.isRestrictedUrl(tab_url) &&
        self.isPrivacyBadgerEnabled(window.extractHostFromURL(tab_url))) {
      iconFilename = {
        19: chrome.runtime.getURL("icons/badger-19.png"),
        38: chrome.runtime.getURL("icons/badger-38.png")
      };
    } else {
      iconFilename = {
        19: chrome.runtime.getURL("icons/badger-19-disabled.png"),
        38: chrome.runtime.getURL("icons/badger-38-disabled.png")
      };
    }

    chrome.browserAction.setIcon({tabId: tab_id, path: iconFilename});
  },

  /**
   * Merge data exported from a different badger into this badger's storage.
   *
   * @param {Object} data the user data to merge in
   * @param {Boolean} [from_migration=false] set when running from a migration to avoid infinite loop
   */
  mergeUserData: function(data, from_migration) {
    let self = this;
    // The order of these keys is also the order in which they should be imported.
    // It's important that snitch_map be imported before action_map (#1972)
    ["snitch_map", "action_map", "settings_map"].forEach(function(key) {
      if (data.hasOwnProperty(key)) {
        let storageMap = self.storage.getBadgerStorageObject(key);
        storageMap.merge(data[key]);
      }
    });

    // for exports from older Privacy Badger versions:
    // fix yellowlist getting out of sync, remove non-tracking domains, etc.
    if (!from_migration) {
      self.runMigrations();
    }
  }

};

/**************************** Listeners ****************************/

function startBackgroundListeners() {
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == "loading" && tab.url) {
      badger.updateIcon(tab.id, tab.url);
      badger.updateBadge(tabId);
    }
  });

  // Update icon if a tab is replaced or loaded from cache
  chrome.tabs.onReplaced.addListener(function(addedTabId/*, removedTabId*/) {
    chrome.tabs.get(addedTabId, function(tab) {
      badger.updateIcon(tab.id, tab.url);
    });
  });

  chrome.tabs.onActivated.addListener(function (activeInfo) {
    badger.updateBadge(activeInfo.tabId);
  });
}

var badger = window.badger = new Badger();
