/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

import { extractHostFromURL, getBaseDomain } from "../lib/basedomain.js";

import { log } from "./bootstrap.js";
import constants from "./constants.js";
import FirefoxAndroid from "./firefoxandroid.js";
import HeuristicBlocking from "./heuristicblocking.js";
import incognito from "./incognito.js";
import { Migrations } from "./migrations.js";
import widgetLoader from "./socialwidgetloader.js";
import BadgerPen from "./storage.js";
import TabData from "./tabdata.js";
import webrequest from "./webrequest.js";
import utils from "./utils.js";

/**
 * Privacy Badger constructor.
 *
 * @param {Boolean} from_qunit don't intercept requests when run by unit tests
 */
function Badger(from_qunit) {
  let self = this;

  self.isFirstRun = false;
  self.isUpdate = false;

  self.widgetList = [];
  let widgetListPromise = widgetLoader.loadWidgetsFromFile(
    "data/socialwidgets.json").catch(console.error);
  widgetListPromise.then(widgets => {
    self.widgetList = widgets;
  });

  self.storage = new BadgerPen(onStorageReady);

  // initialize all chrome.* API listeners on first turn of event loop
  if (!from_qunit) {
    incognito.startListeners();
    webrequest.startListeners();
    HeuristicBlocking.startListeners();
    FirefoxAndroid.startListeners();
    startBackgroundListeners();
  }

  /**
   * Callback that continues Privacy Badger initialization
   * once Badger storage is ready.
   */
  async function onStorageReady() {
    self.heuristicBlocking = new HeuristicBlocking.HeuristicBlocker(self.storage);

    self.setPrivacyOverrides();

    // kick off async initialization steps
    let ylistPromise = self.initYellowlist().catch(console.error),
      dntHashesPromise = self.initDntPolicyHashes().catch(console.error),
      tabDataPromise = self.tabData.initialize().catch(console.error);

    // async load known CNAME domain aliases (but don't wait on them)
    self.initializeCnames().catch(console.error);

    // seed data depends on the yellowlist
    await ylistPromise;
    let seedDataPromise = self.updateTrackerData().catch(console.error);

    // set badge text color to white in Firefox 63+
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1474110
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1424620
    if (utils.hasOwn(chrome.browserAction, 'setBadgeTextColor')) {
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

    if (self.isUpdate) {
      self.runMigrations();
    }

    console.log("Privacy Badger is ready to rock!");
    console.log("Set DEBUG=1 to view console messages.");
    self.INITIALIZED = true;

    if (!from_qunit) {
      self.initYellowlistUpdates();
      self.initDntPolicyUpdates();
    }
  }

} /* end of Badger constructor */

Badger.prototype = {
  INITIALIZED: false,

  /**
   * Mapping of tab IDs to tab-specific data
   * such as frame URLs and found trackers
   */
  tabData: new TabData(),

  /**
   * Mapping of known CNAME domain aliases
   */
  cnameDomains: {},

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
  },

  /**
   * Loads seed dataset with pre-trained action and snitch maps.
   * @param {Function} cb callback
   */
  loadSeedData: function (cb) {
    let self = this;

    utils.fetchResource(constants.SEED_DATA_LOCAL_URL, function (err, response) {
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

      self.mergeUserData(data);
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

  initWelcomePage: function () {
    let self = this,
      privateStore = self.getPrivateSettings();

    if (self.isFirstRun) {
      // work around the welcome page getting closed by an extension restart
      // such as in response to being granted Private Browsing permission
      // from the post-install doorhanger on Firefox
      setTimeout(function () {
        privateStore.setItem("firstRunTimerFinished", true);
      }, utils.oneMinute());

      self.showWelcomePage();

    } else if (!privateStore.getItem("firstRunTimerFinished")) {
      privateStore.setItem("firstRunTimerFinished", true);
      self.showWelcomePage();
    }
  },

  showWelcomePage: function () {
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
        getBaseDomain(domain), domain);
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

  initializeCnames: function () {
    return fetch(constants.CNAME_DOMAINS_LOCAL_URL)
      .then(response => response.json())
      .then(data => {
        badger.cnameDomains = data;
      });
  },

  /**
   * Initializes the yellowlist from disk.
   *
   * @returns {Promise}
   */
  initYellowlist: function () {
    let self = this;

    return new Promise(function (resolve, reject) {

      if (self.storage.getStore('cookieblock_list').keys().length) {
        log("Yellowlist already initialized from disk");
        return resolve();
      }

      // we don't have the yellowlist initialized yet
      // initialize from disk
      utils.fetchResource(constants.YELLOWLIST_LOCAL_URL, (error, response) => {
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
   * Checks if it's time to fetch the latest yellowlist from eff.org.
   * If it isn't yet time, schedules the next update for when it is.
   */
  initYellowlistUpdates: function () {
    let self = this,
      next_update_time = self.getPrivateSettings().getItem('nextYellowlistUpdateTime'),
      time_now = Date.now();

    if (time_now < next_update_time) {
      let msec_remaining = next_update_time - time_now;
      log("Not yet time to update yellowlist; next update in %s mins",
        Math.round(msec_remaining / 1000 / 60));
      // schedule an update for when the extension remains running that long
      setTimeout(self.updateYellowlist.bind(self), msec_remaining);
      return;
    }

    self.updateYellowlist(err => {
      if (err) {
        console.error(err);
      }
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

    // schedule the next update for long-running extension environments
    setTimeout(self.updateYellowlist.bind(self), utils.oneDay());

    utils.fetchResource(constants.YELLOWLIST_URL, function (err, response) {
      if (err) {
        console.error(
          "Problem fetching yellowlist at",
          constants.YELLOWLIST_URL,
          err
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

      // refresh next update time to help avoid updating on every restart
      self.getPrivateSettings().setItem('nextYellowlistUpdateTime', utils.oneDayFromNow());

      return callback(null);
    });
  },

  /**
   * Initializes DNT policy hashes from disk.
   *
   * @returns {Promise}
   */
  initDntPolicyHashes: function () {
    let self = this;

    return new Promise(function (resolve, reject) {

      if (self.storage.getStore('dnt_hashes').keys().length) {
        log("DNT hashes already initialized from disk");
        return resolve();
      }

      // we don't have DNT hashes initialized yet
      // initialize from disk
      utils.fetchResource(constants.DNT_POLICIES_LOCAL_URL, (error, response) => {
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
   * Checks if it's time to get the latest EFF DNT policy hashes from eff.org.
   * If it isn't yet time, schedules the next update for when it is.
   */
  initDntPolicyUpdates: function () {
    let self = this,
      next_update_time = self.getPrivateSettings().getItem('nextDntHashesUpdateTime'),
      time_now = Date.now();

    if (time_now < next_update_time) {
      let msec_remaining = next_update_time - time_now;
      log("Not yet time to update DNT hashes; next update in %s mins",
        Math.round(msec_remaining / 1000 / 60));
      // schedule an update for when the extension remains running that long
      setTimeout(self.updateDntPolicyHashes.bind(self), msec_remaining);
      return;
    }

    self.updateDntPolicyHashes(err => {
      if (err) {
        console.error(err);
      }
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

    // schedule the next update for long-running extension environments
    setTimeout(self.updateDntPolicyHashes.bind(self), utils.oneDay() * 4);

    if (!self.isCheckingDNTPolicyEnabled()) {
      // user has disabled this, we can check when they re-enable
      setTimeout(function () {
        return cb(null);
      }, 0);
    }

    utils.fetchResource(constants.DNT_POLICIES_URL, function (err, response) {
      if (err) {
        console.error("Problem fetching DNT policy hash list at",
          constants.DNT_POLICIES_URL, err);
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

      // refresh next update time to help avoid updating on every restart
      self.getPrivateSettings().setItem('nextDntHashesUpdateTime', utils.nDaysFromNow(4));

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
    var recheckTime = utils.random(
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
   * @param {String} origin the host to check
   * @param {Function} callback the callback ({Boolean} success_status)
   */
  _checkPrivacyBadgerPolicy: utils.rateLimit(function (origin, callback) {
    const URL = "https://" + origin + "/.well-known/dnt-policy.txt";
    const dntHashesStore = this.storage.getStore('dnt_hashes');

    utils.fetchResource(URL, function (err, response) {
      if (err) {
        callback(false);
        return;
      }
      utils.sha1(response, function(hash) {
        callback(dntHashesStore.hasItem(hash));
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
    disableTopics: true,
    hideBlockedElements: true,
    learnInIncognito: false,
    learnLocally: false,
    migrationLevel: Migrations.length,
    seenComic: false,
    sendDNTSignal: true,
    showCounter: true,
    showExpandedTrackingSection: false,
    showIntroPage: true,
    showNonTrackingDomains: false,
    socialWidgetReplacementEnabled: true,
    widgetReplacementExceptions: [],
    widgetSiteAllowlist: {},
  },

  /**
   * Initializes settings with defaults if needed,
   * detects whether Badger just got installed or upgraded
   */
  initSettings: function () {
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

    // initialize any other private store (not-for-export) settings
    let privateDefaultSettings = {
      blockThreshold: constants.TRACKING_THRESHOLD,
      firstRunTimerFinished: true,
      nextDntHashesUpdateTime: 0,
      nextYellowlistUpdateTime: 0,
      showLearningPrompt: false,
      shownBreakageNotes: [],
    };
    for (let key of Object.keys(privateDefaultSettings)) {
      if (!privateStore.hasItem(key)) {
        privateStore.setItem(key, privateDefaultSettings[key]);
      }
    }
    if (self.isFirstRun) {
      privateStore.setItem("firstRunTimerFinished", false);
    }
    badger.initDeprecations();

    // remove obsolete settings
    if (self.isUpdate) {
      [
        "disableFloc",
        "preventWebRTCIPLeak",
        "showTrackingDomains",
        "webRTCIPProtection",
      ].forEach(item => {
        if (settings.hasItem(item)) { settings.deleteItem(item); }
      });

      [
        "legacyWebRtcProtectionUser",
        "showWebRtcDeprecation",
      ].forEach(item => {
        if (privateStore.hasItem(item)) { privateStore.deleteItem(item); }
      });
    }
  },

  /**
   * Initializes private flags that keep track of deprecated features.
   *
   * Called on Badger startup and user data import.
   */
  initDeprecations: function () {},

  runMigrations: function () {
    let self = this,
      settings = self.getSettings(),
      migrationLevel = settings.getItem('migrationLevel');

    for (let i = migrationLevel; i < Migrations.length; i++) {
      Migrations[i].call(self);
      settings.setItem('migrationLevel', i+1);
    }
  },

  /**
   * Returns the count of tracking domains for a tab.
   * @param {Integer} tab_id browser tab ID
   * @returns {Integer} tracking domains count
   */
  getTrackerCount: function (tab_id) {
    let trackers = this.tabData.getTrackers(tab_id),
      count = 0;

    for (let domain in trackers) {
      let action = trackers[domain];
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
      if (!self.tabData.has(tab_id) ||
        !self.getSettings().getItem("showCounter") ||
        !self.isPrivacyBadgerEnabled(self.tabData.getFrameData(tab_id).host)
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
   * Returns whether Privacy Badger is enabled on a given hostname.
   *
   * @param {String} host the FQDN to check
   *
   * @returns {Boolean}
   */
  isPrivacyBadgerEnabled: function (host) {
    let sitePatterns = this.getSettings().getItem("disabledSites") || [];

    for (let pattern of sitePatterns) {
      if (pattern.startsWith("*") && host.endsWith(pattern.slice(1))) {
        return false;
      } else if (pattern === host) {
        return false;
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

  /**
   * Returns whether we should send DNT/GPC signals on a given website.
   *
   * @param {String} site_host the FQDN of the website
   *
   * @returns {Boolean}
   */
  isDntSignalEnabled: function (site_host) {
    if (!this.getSettings().getItem("sendDNTSignal")) {
      return false;
    }
    // temp. exception list for sites
    // where sending DNT/GPC signals causes major breakages
    // TODO indicate when this happens in the UI somehow
    const gpcDisabledWebsites = {
      'www.costco.com': true,
    };
    return !utils.hasOwn(gpcDisabledWebsites, site_host);
  },

  isCheckingDNTPolicyEnabled: function() {
    return this.getSettings().getItem("checkForDNTPolicy");
  },

  isTopicsOverwriteEnabled: function () {
    if (document.browsingTopics) {
      return this.getSettings().getItem("disableTopics");
    }
    return false;
  },

  /**
   * Adds a domain to the list of disabled sites.
   *
   * @param {String} domain The site domain to disable PB for
   */
  disableOnSite: function (domain) {
    let settings = this.getSettings();
    let disabledSites = settings.getItem('disabledSites');
    if (disabledSites.indexOf(domain) < 0) {
      disabledSites.push(domain);
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
   * Removes a domain from the list of disabled sites.
   *
   * @param {String} domain The site domain to re-enable PB on
   */
  reenableOnSite: function (domain) {
    let settings = this.getSettings();
    let disabledSites = settings.getItem("disabledSites");
    let idx = disabledSites.indexOf(domain);
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
   * Records third party FQDNs to tabData for use in the popup,
   * and if necessary updates the badge.
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
      trackers = self.tabData.getTrackers(tab_id),
      previously_blocked = utils.hasOwn(trackers, fqdn) && (
        trackers[fqdn] == constants.BLOCK ||
        trackers[fqdn] == constants.COOKIEBLOCK ||
        trackers[fqdn] == constants.USER_BLOCK ||
        trackers[fqdn] == constants.USER_COOKIEBLOCK
      );

    self.tabData.logTracker(tab_id, fqdn, action);

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
        self.isPrivacyBadgerEnabled(extractHostFromURL(tab_url))) {
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
   * Merges Privacy Badger user data.
   *
   * Used to load pre-trained/"seed" data on installation and updates.
   * Also used to import user data from other Privacy Badger instances.
   *
   * @param {Object} data the user data to merge in
   */
  mergeUserData: function (data) {
    let self = this;

    // fix incoming snitch map entries with current MDFP data
    if (utils.hasOwn(data, "snitch_map")) {
      let correctedSites = {};

      for (let domain in data.snitch_map) {
        let newSnitches = data.snitch_map[domain].filter(
          site => utils.isThirdPartyDomain(site, domain));

        if (newSnitches.length) {
          correctedSites[domain] = newSnitches;
        }
      }

      data.snitch_map = correctedSites;
    }

    // The order of these keys is also the order in which they should be imported.
    // It's important that snitch_map be imported before action_map (#1972)
    for (let key of ["snitch_map", "action_map", "settings_map", "tracking_map", "fp_scripts"]) {
      if (utils.hasOwn(data, key)) {
        self.storage.getStore(key).merge(data[key]);
      }
    }
  }

};

/**************************** Listeners ****************************/

function startBackgroundListeners() {
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (badger.INITIALIZED && changeInfo.status == "loading" && tab.url) {
      badger.updateIcon(tab.id, tab.url);
      badger.updateBadge(tabId);
    }
  });

  // Update icon if a tab is replaced or loaded from cache
  chrome.tabs.onReplaced.addListener(function(addedTabId/*, removedTabId*/) {
    if (badger.INITIALIZED) {
      chrome.tabs.get(addedTabId, function(tab) {
        badger.updateIcon(tab.id, tab.url);
      });
    }
  });

  chrome.tabs.onActivated.addListener(function (activeInfo) {
    if (badger.INITIALIZED) {
      badger.updateBadge(activeInfo.tabId);
    }
  });
}

let badger = window.badger = new Badger(document.location.pathname == "/tests/index.html");
