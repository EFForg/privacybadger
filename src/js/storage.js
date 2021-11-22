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

/* globals badger:false, log:false */

require.scopes.storage = (function () {

let constants = require("constants");
let utils = require("utils");

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
  chrome.storage.local.get(self.KEYS, function (store) {
    self.KEYS.forEach(key => {
      if (utils.hasOwn(store, key)) {
        self[key] = new BadgerStorage(key, store[key]);
      } else {
        let storageObj = new BadgerStorage(key, {});
        self[key] = storageObj;
        _syncStorage(storageObj);
      }
    });

    if (!chrome.storage.managed) {
      callback(self);
      return;
    }

    // see if we have any enterprise/admin/group policy overrides
    chrome.storage.managed.get(null, function (managedStore) {
      if (chrome.runtime.lastError) {
        // ignore "Managed storage manifest not found" errors in Firefox
      }

      if (utils.isObject(managedStore)) {
        let settings = {};
        for (let key in badger.defaultSettings) {
          if (utils.hasOwn(managedStore, key)) {
            settings[key] = managedStore[key];
          }
        }
        self.settings_map.merge(settings);
      }

      callback(self);
    });
  });
}

BadgerPen.prototype = {
  KEYS: [
    "snitch_map",
    "action_map",
    "cookieblock_list",
    "dnt_hashes",
    "settings_map",
    "private_storage", // misc. utility settings, not for export
  ],

  getStore: function (key) {
    if (utils.hasOwn(this, key)) {
      return this[key];
    }
    console.error("Can't initialize cache from getStore. You are using this API improperly");
  },

  /**
   * Reset the snitch map and action map, forgetting all data the badger has
   * learned from browsing.
   */
  clearTrackerData: function () {
    let self = this;
    ['snitch_map', 'action_map'].forEach(key => {
      self.getStore(key).updateObject({});
    });
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

  touchDNTRecheckTime: function(domain, time) {
    this._setupDomainAction(domain, time, "nextUpdateTime");
  },

  getNextUpdateForDomain: function(domain) {
    var action_map = this.getStore('action_map');
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

    log('adding to cookie blocklist:', addedDomains);
    addedDomains.forEach(function (domain) {
      ylistStorage.setItem(domain, true);

      const base = window.getBaseDomain(domain);
      if (actionMap.hasItem(base)) {
        const action = actionMap.getItem(base).heuristicAction;
        // if the domain's base domain is marked for blocking
        if (action == constants.BLOCK || action == constants.COOKIEBLOCK) {
          // cookieblock the domain
          self.setupHeuristicAction(domain, constants.COOKIEBLOCK);
        }
      }
    });

    log('removing from cookie blocklist:', removedDomains);
    removedDomains.forEach(function (domain) {
      ylistStorage.deleteItem(domain);

      const base = window.getBaseDomain(domain);
      // "subdomains" include the domain itself
      for (const subdomain of actionMap.keys()) {
        if (window.getBaseDomain(subdomain) == base) {
          if (self.getAction(subdomain) != constants.NO_TRACKING) {
            badger.heuristicBlocking.blocklistOrigin(base, subdomain);
          }
        }
      }
    });
  },

  /**
   * Update DNT policy hashes
   */
  updateDntHashes: function (hashes) {
    var dnt_hashes = this.getStore('dnt_hashes');
    dnt_hashes.updateObject(utils.invert(hashes));
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
      action_map = self.getStore('action_map'),
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
      if (action_map.hasItem(domain)) {
        let action = self.getAction(
          action_map.getItem(domain),
          // ignore DNT unless it's directly on the FQDN being checked
          domain != fqdn
        );
        if (getScore(action) >= getScore(best_action)) {
          best_action = action;
        }
      }
    }

    return best_action;
  },

  /**
   * Find every domain in the action_map where the presumed action would be {selector}
   *
   * @param {String} selector the action to select by
   * @return {Array} an array of FQDN strings
   */
  getAllDomainsByPresumedAction: function (selector) {
    var action_map = this.getStore('action_map');
    var relevantDomains = [];
    for (var domain in action_map.getItemClones()) {
      if (selector == this.getAction(domain)) {
        relevantDomains.push(domain);
      }
    }
    return relevantDomains;
  },

  /**
   * Get all tracking domains from action_map.
   *
   * @return {Object} An object with domains as keys and actions as values.
   */
  getTrackingDomains: function () {
    let action_map = this.getStore('action_map');
    let origins = {};

    for (let domain in action_map.getItemClones()) {
      let action = badger.storage.getBestAction(domain);
      if (action != constants.NO_TRACKING) {
        origins[domain] = action;
      }
    }

    return origins;
  },

  /**
   * Set up an action for a domain of the given action type in action_map
   *
   * @param {String} domain the domain to set the action for
   * @param {String} action the action to take e.g. BLOCK || COOKIEBLOCK || DNT
   * @param {String} actionType the type of action we are setting, one of "userAction", "heuristicAction", "dnt"
   * @private
   */
  _setupDomainAction: function (domain, action, actionType) {
    let msg = "action_map['%s'].%s = %s",
      action_map = this.getStore("action_map"),
      actionObj = {};

    if (action_map.hasItem(domain)) {
      actionObj = action_map.getItem(domain);
      msg = "Updating " + msg;
    } else {
      actionObj = _newActionMapObject();
      msg = "Initializing " + msg;
    }
    actionObj[actionType] = action;

    if (window.DEBUG) { // to avoid needless JSON.stringify calls
      log(msg, domain, actionType, JSON.stringify(action));
    }
    action_map.setItem(domain, actionObj);
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
   * @param {String} domain Domain to add
   */
  setupDNT: function(domain) {
    this._setupDomainAction(domain, true, "dnt");
  },

  /**
   * Remove DNT setting from a domain*
   * @param {String} domain FQDN string
   */
  revertDNT: function(domain) {
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
  revertUserAction: function(domain) {
    this._setupDomainAction(domain, "", "userAction");

    // if Privacy Badger never recorded tracking for this domain,
    // remove the domain's entry from Privacy Badger's database
    const actionMap = this.getStore("action_map");
    if (actionMap.getItem(domain).heuristicAction == "") {
      log("Removing %s from action_map", domain);
      actionMap.deleteItem(domain);
    }
  },

  /**
   * Removes a base domain and its subdomains from snitch and action maps.
   * Preserves action map entries with user overrides.
   *
   * @param {String} base_domain
   */
  forget: function (base_domain) {
    let self = this,
      dot_base = '.' + base_domain,
      actionMap = self.getStore('action_map'),
      actions = actionMap.getItemClones(),
      snitchMap = self.getStore('snitch_map');

    if (snitchMap.getItem(base_domain)) {
      log("Removing %s from snitch_map", base_domain);
      badger.storage.getStore("snitch_map").deleteItem(base_domain);
    }

    for (let domain in actions) {
      if (domain == base_domain || domain.endsWith(dot_base)) {
        if (actions[domain].userAction == "") {
          log("Removing %s from action_map", domain);
          actionMap.deleteItem(domain);
        }
      }
    }
  }
};

/**
 * @returns {{userAction: null, dnt: null, heuristicAction: null}}
 * @private
 */
var _newActionMapObject = function() {
  return {
    userAction: "",
    dnt: false,
    heuristicAction: "",
    nextUpdateTime: 0
  };
};

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
var BadgerStorage = function(name, seed) {
  this.name = name;
  this._store = seed;
};

BadgerStorage.prototype = {
  /**
   * Check if this storage object has an item
   *
   * @param {String} key - the key for the item
   * @return {Boolean}
   */
  hasItem: function(key) {
    var self = this;
    return utils.hasOwn(self._store, key);
  },

  /**
   * Get an item
   *
   * @param {String} key - the key for the item
   * @return {?*} the value for that key or null
   */
  getItem: function(key) {
    var self = this;
    if (self.hasItem(key)) {
      return self._store[key];
    } else {
      return null;
    }
  },

  /**
   * Get all items in the object as a copy
   *
   * @return {*} the items in badgerObject
   */
  getItemClones: function() {
    var self = this;
    return JSON.parse(JSON.stringify(self._store));
  },

  /**
   * Set an item
   *
   * @param {String} key - the key for the item
   * @param {*} value - the new value
   */
  setItem: function(key,value) {
    var self = this;
    self._store[key] = value;
    // Async call to syncStorage.
    setTimeout(function() {
      _syncStorage(self);
    }, 0);
  },

  /**
   * Delete an item
   *
   * @param {String} key - the key for the item
   */
  deleteItem: function(key) {
    var self = this;
    delete self._store[key];
    // Async call to syncStorage.
    setTimeout(function() {
      _syncStorage(self);
    }, 0);
  },

  /**
   * Update the entire object that this instance is storing
   */
  updateObject: function(object) {
    var self = this;
    self._store = object;
    // Async call to syncStorage.
    setTimeout(function() {
      _syncStorage(self);
    }, 0);
  },

  /**
   * @returns {Array} this storage object's store keys
   */
  keys: function () {
    return Object.keys(this._store);
  },

  /**
   * When a user imports a tracker and settings list via the Import function,
   * we want to overwrite any existing settings, while simultaneously merging
   * in any new information (i.e. the list of disabled site domains). In order
   * to do this, we need different logic for each of the storage maps based on
   * their internal structure. The three cases in this function handle each of
   * the three storage maps that can be exported.
   *
   * @param {Object} mapData The object containing storage map data to merge
   */
  merge: function (mapData) {
    const self = this;

    if (self.name == "settings_map") {
      for (let prop in mapData) {
        // combine array settings via intersection/union
        if (prop == "disabledSites" || prop == "widgetReplacementExceptions") {
          self._store[prop] = utils.concatUniq(self._store[prop], mapData[prop]);

        // string/array map
        } else if (prop == "widgetSiteAllowlist") {
          // for every site host in the import
          for (let site in mapData[prop]) {
            // combine exception arrays
            self._store[prop][site] = utils.concatUniq(
              self._store[prop][site],
              mapData[prop][site]
            );
          }

        // default: overwrite existing setting with setting from import
        } else {
          if (utils.hasOwn(badger.defaultSettings, prop)) {
            self._store[prop] = mapData[prop];
          } else {
            console.error("Unknown Badger setting:", prop);
          }
        }
      }

    } else if (self.name == "action_map") {
      for (let domain in mapData) {
        let action = mapData[domain];

        // Copy over any user settings from the merged-in data
        if (action.userAction) {
          if (utils.hasOwn(self._store, domain)) {
            self._store[domain].userAction = action.userAction;
          } else {
            self._store[domain] = Object.assign(_newActionMapObject(), action);
          }
        }

        // handle Do Not Track
        if (utils.hasOwn(self._store, domain)) {
          // Merge DNT settings if the imported data has a more recent update
          if (action.nextUpdateTime > self._store[domain].nextUpdateTime) {
            self._store[domain].nextUpdateTime = action.nextUpdateTime;
            self._store[domain].dnt = action.dnt;
          }
        } else {
          // Import action map entries for new DNT-compliant domains
          if (action.dnt) {
            self._store[domain] = Object.assign(_newActionMapObject(), action);
          }
        }
      }

    } else if (self.name == "snitch_map") {
      for (let tracker_base in mapData) {
        let siteBases = mapData[tracker_base];
        for (let siteBase of siteBases) {
          badger.heuristicBlocking.updateTrackerPrevalence(
            tracker_base, tracker_base, siteBase);
        }
      }
    }

    // Async call to syncStorage.
    setTimeout(function () {
      _syncStorage(self);
    }, 0);
  }
};

var _syncStorage = (function () {
  var debouncedFuncs = {};

  function cb() {
    if (chrome.runtime.lastError) {
      let err = chrome.runtime.lastError.message;
      if (!err.startsWith("IO error:") && !err.startsWith("Corruption:")
      && !err.startsWith("InvalidStateError:") && !err.startsWith("AbortError:")
      && !err.startsWith("QuotaExceededError:")
      ) {
        badger.criticalError = err;
      }
      console.error("Error writing to chrome.storage.local:", err);
    }
  }

  function sync(badgerStorage) {
    var obj = {};
    obj[badgerStorage.name] = badgerStorage._store;
    chrome.storage.local.set(obj, cb);
  }

  // Creates debounced versions of "sync" function,
  // one for each distinct badgerStorage value.
  return function (badgerStorage) {
    if (!utils.hasOwn(debouncedFuncs, badgerStorage.name)) {
      // call sync at most once every two seconds
      debouncedFuncs[badgerStorage.name] = utils.debounce(function () {
        sync(badgerStorage);
      }, 2000);
    }
    debouncedFuncs[badgerStorage.name]();
  };
}());

/************************************** exports */
let exports = {
  BadgerPen,
};
return exports;
/************************************** exports */

}());
