/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

var constants = require("constants");
var utils = require("utils");

require.scopes.storage = (function() {


/**
 * # Storage Objects
 *
 * snitch_map is our collection of potential tracking base_domains.
 * The key is a base domain (ETLD+1) and the value is an array of first
 * party domains on which this tracker has been seen.
 * it looks like this:
 * {
 *   "third-party.com": ["a.com", "b.com", "c.com"],
 *   "eviltracker.net": ["eff.org", "a.com"]
 * }
 *
 * action_map is where we store the action for each domain that we have
 * decided on an action for. Each subdomain gets its own entry. For example:
 * {
 *   "google.com": { heuristicAction: "block", dnt: false, userAction: ""}
 *   "fonts.google.com": { heuristicAction: "cookieblock", dnt: false, userAction: ""}
 *   "apis.google.com": { heuristicAction: "cookieblock", dnt: false, userAction: "user_block"}
 *   "widget.eff.org": { heuristicAction: "block", dnt: true, userAction: ""}
 * }
 *
 * cookieblock_list is where we store the current yellowlist as
 * downloaded from eff.org. The keys are the domains which should be "cookieblocked".
 * The values are simply 'true'. For example:
 * {
 *   "maps.google.com": true,
 *   "creativecommons.org": true,
 * }
 *
 */

function BadgerPen(callback) {
  var self = this;

  if (!callback) {
    callback = _.noop;
  }

  // initialize from extension local storage
  chrome.storage.local.get(self.KEYS, function (store) {
    _.each(self.KEYS, function (key) {
      if (store.hasOwnProperty(key)) {
        self[key] = new BadgerStorage(key, store[key]);
      } else {
        var storage_obj = new BadgerStorage(key, {});
        self[key] = storage_obj;
        _syncStorage(storage_obj);
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

      if (_.isObject(managedStore)) {
        let settings = {};
        for (let key in badger.defaultSettings) {
          if (managedStore.hasOwnProperty(key)) {
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
  ],

  getBadgerStorageObject: function(key) {

    if (this.hasOwnProperty(key)) {
      return this[key];
    }
    console.error("Can't initialize cache from getBadgerStorageObject. You are using this API improperly");
  },

  /**
   * Reset the snitch map and action map, forgetting all data the badger has
   * learned from browsing.
   */
  clearTrackerData: function() {
    var self = this;
    _.each(['snitch_map', 'action_map'], function(key) {
      self.getBadgerStorageObject(key).updateObject({});
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

    if (_.isString(domain)) {
      domain = this.getBadgerStorageObject('action_map').getItem(domain) || {};
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
    var action_map = this.getBadgerStorageObject('action_map');
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
      actionMap = self.getBadgerStorageObject('action_map'),
      yellowlistStorage = self.getBadgerStorageObject('cookieblock_list'),
      oldDomains = Object.keys(yellowlistStorage.getItemClones());

    let addedDomains = _.difference(newDomains, oldDomains),
      removedDomains = _.difference(oldDomains, newDomains);

    log('removing from cookie blocklist:', removedDomains);
    removedDomains.forEach(function (domain) {
      yellowlistStorage.deleteItem(domain);

      const base = window.getBaseDomain(domain);
      // "subdomains" include the domain itself
      for (const subdomain of Object.keys(actionMap.getItemClones())) {
        if (window.getBaseDomain(subdomain) == base) {
          if (self.getAction(subdomain) != constants.NO_TRACKING) {
            badger.heuristicBlocking.blacklistOrigin(base, subdomain);
          }
        }
      }
    });

    log('adding to cookie blocklist:', addedDomains);
    addedDomains.forEach(function (domain) {
      yellowlistStorage.setItem(domain, true);

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
  },

  /**
   * Update DNT policy hashes
   */
  updateDNTHashes: function(hashes) {
    var dnt_hashes = this.getBadgerStorageObject('dnt_hashes');
    dnt_hashes.updateObject(_.invert(hashes));
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
    let best_action = constants.NO_TRACKING;
    let subdomains = utils.explodeSubdomains(fqdn);
    let action_map = this.getBadgerStorageObject('action_map');

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
        case constants.USER_COOKIE_BLOCK:
          return 5;
      }
    }

    // Loop through each subdomain we have a rule for
    // from least (base domain) to most (FQDN) specific
    // and keep the one which has the best score.
    for (let i = subdomains.length; i >= 0; i--) {
      let domain = subdomains[i];
      if (action_map.hasItem(domain)) {
        let action = this.getAction(
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
    var action_map = this.getBadgerStorageObject('action_map');
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
    let action_map = this.getBadgerStorageObject('action_map');
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
   * Get the number of domains that the given FQDN has been seen tracking on
   *
   * @param {String} fqdn domain to check status of
   * @return {Integer} the number of domains fqdn has been tracking on
   */
  getTrackingCount: function(fqdn) {
    var snitch_map = this.getBadgerStorageObject('snitch_map');
    if (snitch_map.hasItem(fqdn)) {
      return snitch_map.getItem(fqdn).length;
    } else {
      return 0;
    }
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
      action_map = this.getBadgerStorageObject("action_map"),
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
    const actionMap = this.getBadgerStorageObject("action_map");
    if (actionMap.getItem(domain).heuristicAction == "") {
      log("Removing %s from action_map", domain);
      actionMap.deleteItem(domain);
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
 * Privacy Badger Storage Object. Has methods for getting, setting and deleting
 * should be used for all storage needs, transparently handles data presistence
 * syncing and private browsing.
 * Usage:
 * example_map = getBadgerStorageObject('example_map');
 * # instance of BadgerStorage
 * example_map.setItem('foo', 'bar')
 * # null
 * example_map
 * # { foo: "bar" }
 * example_map.hasItem('foo')
 * # true
 * example_map.getItem('foo');
 * # 'bar'
 * example_map.getItem('not_real');
 * # undefined
 * example_map.deleteItem('foo');
 * # null
 * example_map.hasItem('foo');
 * # false
 *
 */

/**
 * BadgerStorage constructor
 * *DO NOT USE DIRECTLY* Instead call `getBadgerStorageObject(name)`
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
    return self._store.hasOwnProperty(key);
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
   * When a user imports a tracker and settings list via the Import function,
   * we want to overwrite any existing settings, while simultaneously merging
   * in any new information (i.e. the set of whitelisted domains). In order
   * to do this, we need different logic for each of the storage maps based on
   * their internal structure. The three cases in this function handle each of
   * the three storage maps that can be exported.
   *
   * @param {Object} mapData The object containing storage map data to merge
   */
  merge: function (mapData) {
    const self = this;

    if (self.name === "settings_map") {
      for (let prop in mapData) {
        if (prop === "disabledSites") {
          // Add new sites to list of existing disabled sites
          self._store[prop] = _.union(self._store[prop], mapData[prop]);
        } else {
          // Overwrite existing setting with setting from import.
          self._store[prop] = mapData[prop];
        }
      }

    } else if (self.name === "action_map") {
      for (let domain in mapData) {
        let action = mapData[domain];

        // Copy over any user settings from the merged-in data
        if (action.userAction != "") {
          if (self._store.hasOwnProperty(domain)) {
            self._store[domain].userAction = action.userAction;
          } else {
            self._store[domain] = action;
          }
        }

        // handle Do Not Track
        if (self._store.hasOwnProperty(domain)) {
          // Merge DNT settings if the imported data has a more recent update
          if (action.nextUpdateTime > self._store[domain].nextUpdateTime) {
            self._store[domain].nextUpdateTime = action.nextUpdateTime;
            self._store[domain].dnt = action.dnt;
          }
        } else {
          // Import action map entries for new DNT-compliant domains
          if (action.dnt) {
            self._store[domain] = action;
          }
        }
      }

    } else if (self.name === "snitch_map") {
      for (let tracker_fqdn in mapData) {
        var firstPartyOrigins = mapData[tracker_fqdn];
        for (let origin in firstPartyOrigins) {
          badger.heuristicBlocking.updateTrackerPrevalence(
            tracker_fqdn,
            firstPartyOrigins[origin],
            true // skip DNT policy checking on data import
          );
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
      if (!err.startsWith("IO error:") && !err.startsWith("Corruption:")) {
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
    if (!debouncedFuncs.hasOwnProperty(badgerStorage.name)) {
      // call sync at most once every two seconds
      debouncedFuncs[badgerStorage.name] = _.debounce(function () {
        sync(badgerStorage);
      }, 2000);
    }
    debouncedFuncs[badgerStorage.name]();
  };
}());

/************************************** exports */
var exports = {};

exports.BadgerPen = BadgerPen;

return exports;
/************************************** exports */
}());
