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

  self.isFirstRun = false;
  self.isUpdate = false;

  self.webRTCAvailable = checkWebRtcBrowserSupport();
  self.firstPartyDomainPotentiallyRequired = testCookiesFirstPartyDomain();

  self.widgetList = [];
  let widgetListPromise = widgetLoader.loadWidgetsFromFile(
    "data/socialwidgets.json").catch(console.error);
  widgetListPromise.then(widgets => {
    self.widgetList = widgets;
  });

  self.storage = new pbStorage.BadgerPen(async function (thisStorage) {
    self.initializeSettings();
    // Privacy Badger settings are now fully ready

    self.heuristicBlocking = new HeuristicBlocking.HeuristicBlocker(thisStorage);

    // TODO there are async migrations
    // TODO is this the right place for migrations?
    self.runMigrations();

    self.setPrivacyOverrides();

    // kick off async initialization steps
    let ylistPromise = self.initializeYellowlist().catch(console.error),
      dntHashesPromise = self.initializeDnt().catch(console.error),
      tabDataPromise = self.updateTabList().catch(console.error);

    // seed data depends on the yellowlist
    await ylistPromise;
    let seedDataPromise = self.updateTrackerData().catch(console.error);

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
    await widgetListPromise;
    await seedDataPromise;
    await dntHashesPromise;
    await tabDataPromise;

    if (badger.isFirstRun || badger.isUpdate) {
      // block all widget domains
      // only need to do this when the widget list could have gotten updated
      self.blockWidgetDomains();
      self.blockPanopticlickDomains();
    }

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

    if (self.isFirstRun) {
      self.showFirstRunPage();
    }
  });

  /**
   * WebRTC availability check
   */
  function checkWebRtcBrowserSupport() {
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
          blockedFrameUrls: {
            <parent_frame_id>: [
              {String} blocked frame URL,
              ...
            ],
            ...
          },
          fpData: {
            <script_origin>: {
              canvas: {
                fingerprinting: {Boolean},
                write: {Boolean}
              }
            },
            ...
          },
          frames: {
            <frame_id>: {
              url: {String},
              host: {String}
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

    let self = this;

    /**
     * Sets a browser setting if Privacy Badger is allowed to set it.
     */
    function _set_override(name, api, value) {
      if (!api) {
        return;
      }

      api.get({}, (result) => {
        // exit if this browser setting is controlled by something else
        if (!result.levelOfControl.endsWith("_by_this_extension")) {
          return;
        }

        // if value is null, we want to relinquish control over the setting
        if (value === null) {
          // exit early if the setting isn't actually set (nothing to clear)
          if (result.levelOfControl == "controllable_by_this_extension") {
            return;
          }

          // clear the browser setting and exit
          api.clear({
            scope: 'regular'
          }, () => {
            if (chrome.runtime.lastError) {
              console.error("Failed clearing override:", chrome.runtime.lastError);
            } else {
              console.log("Cleared override", name);
            }
          });

          return;
        }

        // exit if setting is already set to value
        if (result.value === value &&
            result.levelOfControl == "controlled_by_this_extension") {
          return;
        }

        // otherwise set the value
        api.set({
          value,
          scope: 'regular'
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed setting override:", chrome.runtime.lastError);
          } else {
            console.log("Set override", name, "to", value);
          }
        });
      });
    }

    if (chrome.privacy.network) {
      _set_override(
        "networkPredictionEnabled",
        chrome.privacy.network.networkPredictionEnabled,
        (self.getSettings().getItem("disableNetworkPrediction") ? false : null)
      );
    }

    if (chrome.privacy.services) {
      _set_override(
        "alternateErrorPagesEnabled",
        chrome.privacy.services.alternateErrorPagesEnabled,
        (self.getSettings().getItem("disableGoogleNavErrorService") ? false : null)
      );
    }

    if (chrome.privacy.websites) {
      _set_override(
        "hyperlinkAuditingEnabled",
        chrome.privacy.websites.hyperlinkAuditingEnabled,
        (self.getSettings().getItem("disableHyperlinkAuditing") ? false : null)
      );
    }

    // when enabled, WebRTC IP handling policy is set to Mode 3
    // https://tools.ietf.org/html/draft-ietf-rtcweb-ip-handling-01#page-5
    if (badger.webRTCAvailable) {
      _set_override(
        "webRTCIPHandlingPolicy",
        chrome.privacy.network.webRTCIPHandlingPolicy,
        (self.getSettings().getItem("preventWebRTCIPLeak") ? 'default_public_interface_only' : null)
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
   * Loads seed data on extension installation.
   *
   * Clears the database (preserving user-customized sliders)
   * and loads seed data on extension update
   * when local learning is disabled.
   *
   * @returns {Promise}
   */
  updateTrackerData: function () {
    let self = this;

    return new Promise(function (resolve, reject) {
      if (!self.isFirstRun && !self.isUpdate) {
        log("No need to load seed data (existing installation, no update)");
        return resolve();
      }

      let userActions = [];

      if (self.isUpdate) {
        if (self.getSettings().getItem("learnLocally")) {
          log("No need to load seed data (local learning is enabled)");
          return resolve();

        } else {
          let actions = Object.entries(
            self.storage.getStore('action_map').getItemClones());

          log("Clearing tracker data ...");

          // first save user slider modifications
          for (const [domain, actionData] of actions) {
            if (actionData.userAction != "") {
              userActions.push({
                domain,
                action: actionData.userAction
              });
            }
          }

          // clear existing data
          self.storage.clearTrackerData();
        }
      }

      log("Loading seed data ...");
      self.loadSeedData(err => {
        log("Seed data loaded! (err=%o)", err);

        // reapply customized sliders if any
        for (const item of userActions) {
          self.storage.setupUserAction(item.domain, item.action);
        }

        return (err ? reject(err) : resolve());
      });
    });
  },

  showFirstRunPage: function() {
    let settings = this.getSettings();
    if (settings.getItem("showIntroPage")) {
      chrome.tabs.create({
        url: chrome.runtime.getURL("/skin/firstRun.html")
      });
    } else {
      // don't remind users to look at the intro page either
      settings.setItem("seenComic", true);
    }
  },

  /**
   * Blocks all widget domains
   * to ensure that all widgets that could get replaced
   * do get replaced by default for all users.
   */
  blockWidgetDomains() {
    let self = this;

    // compile set of widget domains
    let domains = new Set();
    for (let widget of self.widgetList) {
      for (let domain of widget.domains) {
        if (domain[0] == "*") {
          domain = domain.slice(2);
        }
        domains.add(domain);
      }
    }

    // block the domains
    for (let domain of domains) {
      self.heuristicBlocking.blocklistOrigin(
        window.getBaseDomain(domain), domain);
    }
  },

  /**
   * Blocks the test domains used by Panopticlick.
   *
   * https://github.com/EFForg/privacybadger/issues/2712
   */
  blockPanopticlickDomains() {
    for (let domain of ["trackersimulator.org", "eviltracker.net"]) {
      this.heuristicBlocking.blocklistOrigin(domain, domain);
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
        blockedFrameUrls: {},
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

      if (self.storage.getStore('cookieblock_list').keys().length) {
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

      if (self.storage.getStore('dnt_hashes').keys().length) {
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
    var dnt_hashes = this.storage.getStore('dnt_hashes');

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
    disableGoogleNavErrorService: true,
    disableHyperlinkAuditing: true,
    disableNetworkPrediction: true,
    hideBlockedElements: true,
    learnInIncognito: false,
    learnLocally: false,
    migrationLevel: 0,
    preventWebRTCIPLeak: false,
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
   * Initializes settings with defaults if needed,
   * detects whether Badger just got installed or upgraded
   */
  initializeSettings: function () {
    let self = this,
      settings = self.getSettings();

    for (let key of Object.keys(self.defaultSettings)) {
      // if this setting is not yet in storage,
      if (!settings.hasItem(key)) {
        // set with default value
        let value = self.defaultSettings[key];
        log("setting", key, "=", value);
        settings.setItem(key, value);
      }
    }

    let version = chrome.runtime.getManifest().version,
      privateStore = self.getPrivateSettings(),
      prev_version = privateStore.getItem("badgerVersion");

    // special case for older badgers that kept isFirstRun in storage
    if (settings.hasItem("isFirstRun")) {
      self.isUpdate = true;
      privateStore.setItem("badgerVersion", version);
      privateStore.setItem("showLearningPrompt", true);
      settings.deleteItem("isFirstRun");

    // new install
    } else if (!prev_version) {
      self.isFirstRun = true;
      privateStore.setItem("badgerVersion", version);

    // upgrade
    } else if (version != prev_version) {
      self.isUpdate = true;
      privateStore.setItem("badgerVersion", version);
    }

    if (!privateStore.hasItem("showLearningPrompt")) {
      privateStore.setItem("showLearningPrompt", false);
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
      Migrations.resetWebRtcIpHandlingPolicy3,
      Migrations.forgetOpenDNS,
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
      if (
        action == constants.BLOCK ||
        action == constants.COOKIEBLOCK ||
        action == constants.USER_BLOCK ||
        action == constants.USER_COOKIEBLOCK
      ) {
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
        !self.getSettings().getItem("showCounter") ||
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

  /**
   * Shortcut helper for user-facing settings
   */
  getSettings: function () {
    return this.storage.getStore('settings_map');
  },

  /**
   * Shortcut helper for internal settings
   */
  getPrivateSettings: function () {
    return this.storage.getStore('private_storage');
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
   * Is local learning generally enabled,
   * and if tab_id is for an incognito window,
   * is learning in incognito windows enabled?
   */
  isLearningEnabled(tab_id) {
    return (
      this.getSettings().getItem("learnLocally") &&
      incognito.learningEnabled(tab_id)
    );
  },

  isDNTSignalEnabled: function() {
    return this.getSettings().getItem("sendDNTSignal");
  },

  isCheckingDNTPolicyEnabled: function() {
    return this.getSettings().getItem("checkForDNTPolicy");
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
  hasLocalStorageSupercookie: function (lsItems) {
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
  hasSupercookie: function (storageItems) {
    return (
      this.hasLocalStorageSupercookie(storageItems.localStorageItems)
      //|| this.hasLocalStorageSupercookie(storageItems.indexedDBItems)
      // TODO: See "Reading a directory's contents" on
      // http://www.html5rocks.com/en/tutorials/file/filesystem/
      //|| this.hasLocalStorageSupercookie(storageItems.fileSystemAPIItems)
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
      is_blocked = (
        action == constants.BLOCK ||
        action == constants.COOKIEBLOCK ||
        action == constants.USER_BLOCK ||
        action == constants.USER_COOKIEBLOCK
      ),
      origins = self.tabData[tab_id].origins,
      previously_blocked = origins.hasOwnProperty(fqdn) && (
        origins[fqdn] == constants.BLOCK ||
        origins[fqdn] == constants.COOKIEBLOCK ||
        origins[fqdn] == constants.USER_BLOCK ||
        origins[fqdn] == constants.USER_COOKIEBLOCK
      );

    origins[fqdn] = action;

    // no need to update badge if not a (cookie)blocked domain,
    // or if we have already seen it as a (cookie)blocked domain
    if (!is_blocked || previously_blocked) {
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
   * @param {Boolean} [skip_migrations=false] set when running from a migration to avoid infinite loop
   */
  mergeUserData: function (data, skip_migrations) {
    let self = this;
    // The order of these keys is also the order in which they should be imported.
    // It's important that snitch_map be imported before action_map (#1972)
    ["snitch_map", "action_map", "settings_map"].forEach(function (key) {
      if (data.hasOwnProperty(key)) {
        self.storage.getStore(key).merge(data[key]);
      }
    });

    // for exports from older Privacy Badger versions:
    // fix yellowlist getting out of sync, remove non-tracking domains, etc.
    if (!skip_migrations) {
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
