/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2014 Electronic Frontier Foundation
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

/* globals badger:false */

import { getBaseDomain } from "../lib/basedomain.js";

import { log } from "./bootstrap.js";
import constants from "./constants.js";
import utils from "./utils.js";

function getLocalStorage(keys, callback) {
  function _cb(store) {
    if (chrome.runtime.lastError) {
      console.error("Error reading from chrome.storage.local:",
        chrome.runtime.lastError.message);
    }
    callback(store);
  }

  try {
    chrome.storage.local.get(keys, _cb);
  } catch (ex) {
    console.error("Error reading from chrome.storage.local:", ex);
    callback(null);
  }
}

let readFromStorageWithRetrying = (function () {
  const MAX_TRIES = 5,
    WAIT_TIME = 200;

  let num_tries = 0;

  /**
   * @param {Array} the list of keys to get from extension storage
   * @param {Function} callback
   */
  function _tryReading(keys, callback) {
    getLocalStorage(keys, function (store) {
      if (store) {
        return callback(store);
      }

      num_tries++;
      if (num_tries >= MAX_TRIES) {
        return callback(null);
      }

      setTimeout(function () {
        _tryReading(keys, callback);
      }, WAIT_TIME);
    });
  }

  return _tryReading;
}());

function getManagedStorage(callback) {
  chrome.storage.managed.get(null, function (res) {
    if (chrome.runtime.lastError) {
      // ignore "Managed storage manifest not found" errors in Firefox
    }
    callback(res);
  });
}

function ingestManagedStorage(managedStore) {
  let settings = {};
  for (let key in badger.defaultSettings) {
    if (utils.hasOwn(managedStore, key)) {
      settings[key] = managedStore[key];
    }
  }
  badger.getSettings().merge(settings);
}

let pollForManagedStorage = (function () {
  const POLL_INTERVAL = 300,
    MAX_TRIES = 15; // ~4.5 second delay to see welcome page for most users

  return function (num_tries, callback) {
    getManagedStorage(function (managedStore) {
      if (utils.isObject(managedStore) && Object.keys(managedStore).length) {
        // success
        ingestManagedStorage(managedStore);
        callback();
        return;
      }

      num_tries++;
      if (num_tries <= MAX_TRIES) {
        // retry after a wait
        setTimeout(function () {
          pollForManagedStorage(num_tries, callback);
        }, POLL_INTERVAL);
      } else {
        // give up
        callback();
      }
    });
  };
}());

/**
 * See the following link for documentation of
 * Privacy Badger's data objects in extension storage:
 *
 * https://github.com/EFForg/privacybadger/blob/master/doc/DESIGN-AND-ROADMAP.md#data-structures
 */
function BadgerPen(callback) {
  let self = this;

  if (!callback) {
    callback = function () {};
  }

  // initialize from extension local storage
  readFromStorageWithRetrying(self.KEYS, function (store) {
    for (let key of self.KEYS) {
      if (store && utils.hasOwn(store, key)) {
        self[key] = new BadgerStorage(key, store[key]);
      } else {
        let storageObj = new BadgerStorage(key, {});
        self[key] = storageObj;
        _syncStorage(storageObj);
      }
    }

    if (!store) {
      console.error("Failed to read from extension storage");
      self.settings_map.setItem("showIntroPage", false);
      self.settings_map.setItem("seenComic", true);
    }

    badger.initSettings();

    if (!chrome.storage.managed) {
      setTimeout(function () {
        badger.initWelcomePage();
      }, 0);
      return callback();
    }

    // see if we have any enterprise/admin/group policy overrides
    // but do it async; don't wait on it to finish initializing
    setTimeout(function () {
      getManagedStorage(function (managedStore) {
        if (utils.isObject(managedStore)) {
          // there are values in managed storage
          if (Object.keys(managedStore).length) {
            ingestManagedStorage(managedStore);
            badger.initWelcomePage();
            return;
          }

          // managed storage is an empty object and we just got installed
          if (badger.isFirstRun) {
            // poll for managed storage to work around Chromium bug
            pollForManagedStorage(0, function () {
              badger.initWelcomePage();
            });
            return;
          }
        }

        // managed storage is not an object,
        // or it is an empty object but this isn't the first run
        badger.initWelcomePage();
      });
    }, 0);

    callback();
  });
}

BadgerPen.prototype = {
  KEYS: [
    "snitch_map",
    "action_map",
    "cookieblock_list",
    "dnt_hashes",
    "settings_map",

    // misc. utility settings, not for export
    "private_storage",

    // logs what kind of tracking was observed:
    // {
    //   <tracker_base>: {
    //     <site_base>: [
    //       <tracking_type>, // "beacon", "canvas", or "pixelcookieshare"
    //       ...
    //     ],
    //     ...
    //   },
    //   ...
    // }
    "tracking_map",

    // logs fingerprinter script domains and paths:
    // {
    //   <script_fqdn>: {
    //     <script_path>: 1,
    //     ...
    //   },
    //   ...
    // }
    "fp_scripts",
  ],

  getStore: function (key) {
    if (utils.hasOwn(this, key)) {
      return this[key];
    }
    console.error("Can't initialize cache from getStore. You are using this API improperly");
  },

  /**
   * Empties tracking-related storage, forgetting all data learned from browsing.
   */
  clearTrackerData: function () {
    let self = this;

    for (let store_name of ['action_map', 'snitch_map', 'tracking_map', 'fp_scripts']) {
      let store = self.getStore(store_name);
      for (let key of store.keys()) {
        store.deleteItem(key);
      }
    }
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

    window.DATA_LOAD_IN_PROGRESS = true;

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
        self.getStore(key).merge(data[key]);
      }
    }

    window.DATA_LOAD_IN_PROGRESS = false;
  },

  /**
   * Get the current presumed action for a specific fully qualified domain name (FQDN),
   * ignoring any rules for subdomains below or above it
   *
   * @param {(Object|String)} domain domain object from action_map
   * @param {Boolean} [ignoreDNT] whether to ignore DNT status
   * @returns {String} the presumed action for this FQDN
   */
  getAction: function (domain, ignoreDNT) {
    if (!badger.isCheckingDNTPolicyEnabled()) {
      ignoreDNT = true;
    }

    if (utils.isString(domain)) {
      domain = this.getStore('action_map').getItem(domain) || {};
    }
    if (domain.userAction) { return domain.userAction; }
    if (domain.dnt && !ignoreDNT) { return constants.DNT; }
    if (domain.heuristicAction) { return domain.heuristicAction; }
    return constants.NO_TRACKING;
  },

  touchDNTRecheckTime: function (domain, time) {
    this._setupDomainAction(domain, time, "nextUpdateTime");
  },

  getNextUpdateForDomain: function (domain) {
    let action_map = this.getStore('action_map');
    if (action_map.hasItem(domain)) {
      return action_map.getItem(domain).nextUpdateTime;
    } else {
      return 0;
    }
  },

  /**
   * Updates the yellowlist to the provided array of domains.
   *
   * For each added domain, sets it to be cookieblocked
   * if its parent domain is set to be blocked.
   *
   * @param {Array} newDomains domains to use for the new yellowlist
   */
  updateYellowlist: function (newDomains) {
    let self = this,
      actionMap = self.getStore('action_map'),
      ylistStorage = self.getStore('cookieblock_list'),
      oldDomains = ylistStorage.keys();

    let addedDomains = utils.difference(newDomains, oldDomains),
      removedDomains = utils.difference(oldDomains, newDomains);

    if (addedDomains.length) {
      log("Adding to cookie blocklist:", addedDomains);
    }
    for (let domain of addedDomains) {
      ylistStorage.setItem(domain, true);

      const base = getBaseDomain(domain);
      if (actionMap.hasItem(base)) {
        const action = actionMap.getItem(base).heuristicAction;
        // if the domain's base domain is marked for blocking
        if (action == constants.BLOCK || action == constants.COOKIEBLOCK) {
          // cookieblock the domain
          self.setupHeuristicAction(domain, constants.COOKIEBLOCK);
        }
      }
    }

    if (removedDomains.length) {
      log("Removing from cookie blocklist:", removedDomains);
    }
    for (let domain of removedDomains) {
      ylistStorage.deleteItem(domain);

      const base = getBaseDomain(domain);
      // "subdomains" include the domain itself
      for (const subdomain of actionMap.keys()) {
        if (getBaseDomain(subdomain) == base) {
          if (self.getAction(subdomain) != constants.NO_TRACKING) {
            badger.heuristicBlocking.blocklistOrigin(base, subdomain);
          }
        }
      }
    }
  },

  /**
   * Updates EFF's Do Not Track policy hashes.
   */
  updateDntHashes: function (hashes) {
    let self = this,
      dntPolicyStore = self.getStore('dnt_hashes');

    for (let policy_name in hashes) {
      dntPolicyStore.setItem(hashes[policy_name], policy_name);
    }
  },

  /**
   * Looks up whether an FQDN would get cookieblocked,
   * ignoring user overrides and the FQDN's current status.
   *
   * @param {String} fqdn the FQDN we want to look up
   *
   * @return {Boolean}
   */
  wouldGetCookieblocked: function (fqdn) {
    // cookieblock if a "parent" domain of the fqdn is on the yellowlist
    let set = false,
      ylistStorage = this.getStore('cookieblock_list'),
      // ignore base domains when exploding to work around PSL TLDs:
      // still want to cookieblock somedomain.googleapis.com with only
      // googleapis.com (and not somedomain.googleapis.com itself) on the ylist
      subdomains = utils.explodeSubdomains(fqdn, true);

    for (let i = 0; i < subdomains.length; i++) {
      if (ylistStorage.hasItem(subdomains[i])) {
        set = true;
        break;
      }
    }

    return set;
  },

  /**
   * Find the best action to take for an FQDN, assuming it is third party and
   * Privacy Badger is enabled. Traverse the action list for the FQDN and each
   * of its subdomains and then takes the most appropriate action
   *
   * @param {String} fqdn the FQDN we want to determine the action for
   * @returns {String} the best action for the FQDN
   */
  getBestAction: function (fqdn) {
    let self = this,
      actionStore = self.getStore('action_map'),
      best_action = constants.NO_TRACKING,
      subdomains = utils.explodeSubdomains(fqdn);

    function getScore(action) {
      switch (action) {
      case constants.NO_TRACKING:
        return 0;
      case constants.ALLOW:
        return 1;
      case constants.BLOCK:
        return 2;
      case constants.COOKIEBLOCK:
        return 3;
      case constants.DNT:
        return 4;
      case constants.USER_ALLOW:
      case constants.USER_BLOCK:
      case constants.USER_COOKIEBLOCK:
        return 5;
      }
    }

    // Loop through each subdomain we have a rule for
    // from least (base domain) to most (FQDN) specific
    // and keep the one which has the best score.
    for (let i = subdomains.length - 1; i >= 0; i--) {
      let domain = subdomains[i];
      if (actionStore.hasItem(domain)) {
        let action = self.getAction(
          actionStore.getItem(domain),
          // ignore DNT unless it's directly on the FQDN being checked
          domain != fqdn);
        if (getScore(action) >= getScore(best_action)) {
          best_action = action;
        }
      }
    }

    return best_action;
  },

  /**
   * Get all tracking domains from action_map.
   *
   * @return {Object} An object with domains as keys and actions as values.
   */
  getTrackingDomains: function () {
    let self = this,
      domains = {};

    for (let fqdn of self.getStore('action_map').keys()) {
      let action = self.getBestAction(fqdn);
      if (action != constants.NO_TRACKING) {
        domains[fqdn] = action;
      }
    }

    return domains;
  },

  /**
   * Set up an action for a domain of the given action type in action_map
   *
   * @param {String} domain the domain to set the action for
   * @param {String} action the action to take e.g. BLOCK || COOKIEBLOCK || DNT
   * @param {String} action_type the type of action we are setting, one of "userAction", "heuristicAction", "dnt"
   *
   * @private
   */
  _setupDomainAction: function (domain, action, action_type) {
    let actionStore = this.getStore("action_map"),
      actionObj = {};

    if (actionStore.hasItem(domain)) {
      actionObj = actionStore.getItem(domain);
    } else {
      actionObj = _newActionMapObject();
    }
    actionObj[action_type] = action;

    // avoid thousands of messages from loading seed/user data
    if (window.DEBUG && !window.DATA_LOAD_IN_PROGRESS) {
      let msg = "action_map['%s'].%s = %s";
      if (actionStore.hasItem(domain)) {
        msg = "Updating " + msg;
      } else {
        msg = "Initializing " + msg;
      }
      log(msg, domain, action_type, JSON.stringify(action));
    }

    actionStore.setItem(domain, actionObj);
  },

  /**
   * Add a heuristic action for a domain
   *
   * @param {String} domain Domain to add
   * @param {String} action The heuristic action to take
   */
  setupHeuristicAction: function(domain, action) {
    this._setupDomainAction(domain, action, "heuristicAction");
  },

  /**
   * Set up a domain for DNT
   *
   * @param {String} domain
   */
  setupDNT: function (domain) {
    this._setupDomainAction(domain, true, "dnt");
  },

  /**
   * Remove DNT setting from a domain
   *
   * @param {String} domain
   */
  revertDNT: function (domain) {
    this._setupDomainAction(domain, false, "dnt");
  },

  /**
   * Add a heuristic action for a domain
   *
   * @param {String} domain Domain to add
   * @param {String} action The heuristic action to take
   */
  setupUserAction: function(domain, action) {
    this._setupDomainAction(domain, action, "userAction");
  },

  /**
   * Remove user set action from a domain
   * @param {String} domain FQDN string
   */
  revertUserAction: function (domain) {
    this._setupDomainAction(domain, "", "userAction");

    // if Privacy Badger never recorded tracking for this domain,
    // and it's not a DNT-compliant domain,
    // remove the domain's entry from Privacy Badger's database
    const actionMap = this.getStore("action_map"),
      actions = actionMap.getItem(domain);
    if (actions.heuristicAction == "" && !actions.dnt) {
      log("Removing %s from action_map", domain);
      actionMap.deleteItem(domain);
    }
  },

  /**
   * Forces a write of a Badger storage object's contents to extension storage.
   *
   * @param {?String} store_name storage object's name or null (sync all)
   * @param {Function} callback
   */
  forceSync: function (store_name, callback) {
    let self = this,
      stores = [],
      num_done = 0;

    if (!callback) {
      callback = function () {};
    }

    if (store_name) {
      if (!self.KEYS.includes(store_name)) {
        setTimeout(function () {
          callback("Error: Unknown Badger storage name");
        }, 0);
        return;
      }
      stores.push(store_name);
    } else {
      for (let name of self.KEYS) {
        stores.push(name);
      }
    }

    function done() {
      num_done++;
      if (num_done == stores.length) {
        return callback();
      }
      sync(stores[num_done]);
    }

    function sync(name) {
      _syncStorage(self.getStore(name), true, done);
    }

    sync(stores[0]);
  },

  /**
   * Helps update tracking_map.
   */
  recordTrackingDetails: function (tracker_base, site_base, tracking_type) {
    let self = this,
      trackingDataStore = self.getStore('tracking_map'),
      entry = trackingDataStore.getItem(tracker_base) || {};
    if (!utils.hasOwn(entry, site_base)) {
      entry[site_base] = [];
    }
    if (!entry[site_base].includes(tracking_type)) {
      entry[site_base].push(tracking_type);
    }
    trackingDataStore.setItem(tracker_base, entry);
  },

  /**
   * Helps update fp_scripts.
   */
  recordFingerprintingScript: function (script_fqdn, script_path) {
    let fpStore = this.getStore('fp_scripts'),
      entry = fpStore.getItem(script_fqdn) || {};
    entry[script_path] = 1;
    fpStore.setItem(script_fqdn, entry);
  }
};

/**
 * @private
 */
function _newActionMapObject() {
  return {
    userAction: "",
    dnt: false,
    heuristicAction: "",
    nextUpdateTime: 0
  };
}

/**
 * Privacy Badger Storage Object.
 * Should be used for all storage needs.
 */

/**
 * BadgerStorage constructor
 * *DO NOT USE DIRECTLY* Instead call `getStore(name)`
 * @param {String} name - the name of the storage object
 * @param {Object} seed - the base object which we are instantiating from
 */
function BadgerStorage(name, seed) {
  this.name = name;
  this._store = seed;
  this._subscribers = {}; // basic pub-sub
}

BadgerStorage.prototype = {
  /**
   * Check if this storage object has an item
   *
   * @param {String} key - the key for the item
   * @return {Boolean}
   */
  hasItem: function (key) {
    let self = this;
    return utils.hasOwn(self._store, key);
  },

  /**
   * Get an item
   *
   * @param {String} key - the key for the item
   * @return {?*} the value for that key or null
   */
  getItem: function (key) {
    let self = this;
    if (self.hasItem(key)) {
      // return a clone of the value in storage
      let str = JSON.stringify(self._store[key]);
      return (str === undefined ? str : JSON.parse(str));
    } else {
      return null;
    }
  },

  /**
   * Get all items in the object as a copy
   *
   * @return {*} the items in badgerObject
   */
  getItemClones: function () {
    let self = this;
    return JSON.parse(JSON.stringify(self._store));
  },

  /**
   * Set an item
   *
   * @param {String} key - the key for the item
   * @param {*} value - the new value
   */
  setItem: function (key, value) {
    let self = this;
    self.notify("set:" + key, key, value);
    self._store[key] = value;
    _syncStorage(self);
  },

  /**
   * Delete an item
   *
   * @param {String} key - the key for the item
   */
  deleteItem: function (key) {
    let self = this;
    self.notify("delete:" + key, key);
    delete self._store[key];
    _syncStorage(self);
  },

  /**
   * @returns {Array} this storage object's store keys
   */
  keys: function () {
    return Object.keys(this._store);
  },

  /**
   * When a user imports data via the Import function, we want to overwrite
   * any existing settings, while simultaneously merging in any new information
   * (i.e. the list of disabled site domains). Thus, we need different logic
   * for each of the storage objects based on their internal structure.
   *
   * This is also used to load pre-trained data, and to ingest managed storage.
   *
   * @param {Object} mapData The storage object to merge into existing storage
   */
  merge: function (mapData) {
    const self = this,
      ignoredSiteBases = badger.getPrivateSettings().getItem('ignoredSiteBases');

    if (self.name == "settings_map") {
      for (let prop in mapData) {
        // combine array settings via intersection/union
        if (prop == "disabledSites" || prop == "widgetReplacementExceptions") {
          self.setItem(prop, utils.concatUniq(self.getItem(prop), mapData[prop]));

        // string/array map
        } else if (prop == "widgetSiteAllowlist") {
          let existingEntry = self.getItem(prop);

          // for every site host in the import
          for (let site in mapData[prop]) {
            // combine exception arrays
            existingEntry[site] = utils.concatUniq(
              existingEntry[site], mapData[prop][site]);
          }

          self.setItem(prop, existingEntry);

        // default: overwrite existing setting with setting from import
        } else {
          if (utils.hasOwn(badger.defaultSettings, prop)) {
            self.setItem(prop, mapData[prop]);
          } else {
            console.error("Unknown Badger setting:", prop);
          }
        }
      }

    } else if (self.name == "action_map") {
      let snitchMap = badger.storage.getStore('snitch_map');

      for (let domain in mapData) {
        let newEntry = mapData[domain],
          existingEntry = self.getItem(domain);

        if (existingEntry) {
          // for existing domains, overwrite with user action set in the import
          if (newEntry.userAction) {
            existingEntry.userAction = newEntry.userAction;
            self.setItem(domain, existingEntry);
          }

          // merge DNT settings if the imported data has a more recent update
          if (newEntry.nextUpdateTime > existingEntry.nextUpdateTime) {
            existingEntry.nextUpdateTime = newEntry.nextUpdateTime;
            existingEntry.dnt = newEntry.dnt;
            self.setItem(domain, existingEntry);
          }

        } else {
          // import user-set domains, DNT-compliant domains,
          // and also domains present in snitch_map
          if (newEntry.userAction || newEntry.dnt || snitchMap.getItem(getBaseDomain(domain))) {
            self.setItem(domain, Object.assign(_newActionMapObject(), newEntry));
          }
        }
      }

    } else if (self.name == "snitch_map") {
      for (let tracker_base in mapData) {
        let siteBases = mapData[tracker_base];
        for (let site_base of siteBases) {
          if (!ignoredSiteBases.includes(site_base)) {
            badger.heuristicBlocking.updateTrackerPrevalence(
              tracker_base, tracker_base, site_base);
          }
        }
      }

    } else if (self.name == "tracking_map") {
      // keep up to the number of entries in snitch_map for the tracker,
      // favoring ones with matching site base domains in snitch_map
      let snitchMap = badger.storage.getStore('snitch_map');

      for (let tracker_base in mapData) {
        // merge only if we have a corresponding snitch_map entry
        let snitchItem = snitchMap.getItem(tracker_base);
        if (!snitchItem) {
          continue;
        }

        // first add the entries found in snitch_map
        for (let site_base in mapData[tracker_base]) {
          if (!snitchItem.includes(site_base)) {
            continue;
          }
          for (let tracking_type of mapData[tracker_base][site_base]) {
            badger.storage.recordTrackingDetails(
              tracker_base, site_base, tracking_type);
          }
        }

        // now see if we should add any more entries up to the limit
        let trackerItem = self.getItem(tracker_base);
        if (trackerItem && Object.keys(trackerItem).length >= snitchItem.length) {
          continue;
        }
        for (let site_base in mapData[tracker_base]) {
          if (snitchItem.includes(site_base) || ignoredSiteBases.includes(site_base)) {
            continue;
          }
          for (let tracking_type of mapData[tracker_base][site_base]) {
            badger.storage.recordTrackingDetails(
              tracker_base, site_base, tracking_type);
          }
          if (Object.keys(self.getItem(tracker_base)).length >= snitchItem.length) {
            break;
          }
        }
      }

    } else if (self.name == "fp_scripts") {
      let snitchMap = badger.storage.getStore('snitch_map');
      for (let script_fqdn in mapData) {
        // merge only if we have a corresponding snitch_map entry
        let snitchItem = snitchMap.getItem(getBaseDomain(script_fqdn));
        if (!snitchItem) {
          continue;
        }
        for (let script_path in mapData[script_fqdn]) {
          badger.storage.recordFingerprintingScript(script_fqdn, script_path);
        }
      }
    }
  },

  /**
   * @param {String} name The event to notify subscribers for
   * @param {String} key The storage key being created/updated/deleted
   * @param {*} val The new value being assigned to the key
   */
  notify: function (name, key, val) {
    let self = this;

    function _notify(ename) {
      if (self._subscribers[ename]) {
        for (let fn of self._subscribers[ename]) {
          let str = JSON.stringify(val),
            val_clone = (str === undefined ? str : JSON.parse(str));
          fn.call(self, val_clone, key);
        }
      }
    }

    // don't notify when there is no change
    if (val === self.getItem(key)) {
      return;
    }

    // exact match subscribers
    _notify(name);

    // wildcard subscribers
    _notify(name.slice(0, name.indexOf(":") + 1) + "*");
  },

  /**
   * @param {String} name The event to subscribe to
   * @param {Function} callback
   */
  subscribe: function (name, callback) {
    let self = this;
    if (!self._subscribers[name]) {
      self._subscribers[name] = [];
    }
    self._subscribers[name].push(callback);
  },

  /**
   * @param {String} name The event to clear subscriptions for
   * @returns {Array} The subscriptions removed for that event name
   */
  unsubscribe: function (name) {
    let self = this,
      subs = self._subscribers[name] || [];
    delete self._subscribers[name];
    return subs;
  },
};

let _syncStorage = (function () {
  let debouncedFuncs = {};

  function _sync(badgerStore, callback) {
    if (!callback) {
      callback = function () {};
    }
    let obj = {};
    obj[badgerStore.name] = badgerStore._store;
    chrome.storage.local.set(obj, function () {
      if (!chrome.runtime.lastError) {
        callback(null);
        return;
      }
      let err = chrome.runtime.lastError.message;
      if (err != "An unexpected error occurred" &&
        !err.startsWith("IO error:") && !err.startsWith("Corruption:") &&
        !err.startsWith("InvalidStateError:") && !err.startsWith("AbortError:") &&
        !err.startsWith("QuotaExceededError:")) {
        badger.criticalError = err;
      }
      console.error("Error writing to chrome.storage.local:", err);
      callback(err);
    });
  }

  /**
   * Writes contents of Badger storage objects to extension storage.
   *
   * The writing is debounced by default.
   *
   * @param {BadgerStorage} badgerStore
   * @param {Boolean} [force] perform sync immediately if truthy
   * @param {Function} [callback] ONLY USED WHEN FORCING IMMEDIATE SYNC
   */
  return function (badgerStore, force, callback) {
    // bypass debouncing
    if (force) {
      _sync(badgerStore, callback);
      return;
    }
    // create debounced versions of _sync(), one per BadgerPen.prototype.KEYS
    if (!utils.hasOwn(debouncedFuncs, badgerStore.name)) {
      // call sync at most once every two seconds
      debouncedFuncs[badgerStore.name] = utils.debounce(function () {
        _sync(badgerStore);
      }, 2000);
    }
    debouncedFuncs[badgerStore.name]();
  };
}());

export default BadgerPen;
