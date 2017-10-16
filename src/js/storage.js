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
 * cookieblock_list is where we store the current cookie block list as
 * downloaded from eff.org. The keys are the domains which should be blocked.
 * The values are simply 'true'
 *
 * {
 *   "maps.google.com": true,
 *   "creativecommons.org": true,
 * }
 **/

function BadgerPen(callback) {
  var bp = this;
  // Now check localStorage
  chrome.storage.local.get(bp.KEYS, function (store) {
    _.each(bp.KEYS, function (key) {
      if (store.hasOwnProperty(key)) {
        bp[key] = new BadgerStorage(key, store[key]);
      } else {
        var storage_obj = new BadgerStorage(key, {});
        bp[key] = storage_obj;
        _syncStorage(storage_obj);
      }
    });
    if (_.isFunction(callback)) {
      callback(bp);
    }
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

    if(this.hasOwnProperty(key)){
      return this[key];
    }
    console.error("Can't initialize cache from getBadgerStorageObject. You are using this API improperly");
  },

  /**
   * Get the current presumed action for a specific fully qualified domain name (FQDN),
   * ignoring any rules for subdomains below or above it
   *
   * @param {Object|String} domain domain object from action_map
   * @returns {String} the presumed action for this FQDN
   **/
  getAction: function (domain, ignoreDNT) {
    if(! badger.isCheckingDNTPolicyEnabled()){
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

  touchDNTRecheckTime: function(domain, time){
    this._setupDomainAction(domain, time, "nextUpdateTime");
  },

  getNextUpdateForDomain: function(domain){
    var action_map = this.getBadgerStorageObject('action_map');
    if(action_map.hasItem(domain)){
      return action_map.getItem(domain).nextUpdateTime;
    } else {
      return 0;
    }
  },

  /**
   * Update DNT policy hashes
   */
  updateDNTHashes: function(hashes){
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
   **/
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
   **/
  getAllDomainsByPresumedAction: function(selector){
    var action_map = this.getBadgerStorageObject('action_map');
    var relevantDomains = [];
    for(var domain in action_map.getItemClones()){
      if(selector == this.getAction(domain)){
        relevantDomains.push(domain);
      }
    }
    return relevantDomains;
  },

  /**
   * Get the number of domains that the given FQDN has been seen tracking on
   *
   * @param fqdn domain to check status of
   * @return int the number of domains fqdn has been tracking on
   */
  getTrackingCount: function(fqdn){
    var snitch_map = this.getBadgerStorageObject('snitch_map');
    if(snitch_map.hasItem(fqdn)){
      return snitch_map.getItem(fqdn).length;
    } else {
      return 0;
    }
  },

  /**
   * Set up an action for a domain of the given action type in action_map
   *
   * @param domain the domain to set the action for
   * @param action the action to take e.g. BLOCK || COOKIEBLOCK || DNT
   * @param actionType the type of action we are setting, one of "userAction", "heuristicAction", "dnt"
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

    action_map.setItem(domain, actionObj);

    log(msg, domain, actionType, action);
  },

  /**
   * Add a heuristic action for a domain
   *
   * @param {String} domain Domain to add
   * @param {String} action The heuristic action to take
   */
  setupHeuristicAction: function(domain, action){
    this._setupDomainAction(domain, action, "heuristicAction");
  },

  /**
   * Set up a domain for DNT
   *
   * @param {String} domain Domain to add
   */
  setupDNT: function(domain){
    this._setupDomainAction(domain, true, "dnt");
  },

  /**
   * Remove DNT setting from a domain*
   * @param domain FQDN string
   */
  revertDNT: function(domain){
    this._setupDomainAction(domain, false, "dnt");
  },

  /**
   * Add a heuristic action for a domain and add/remove domain from
   * userAllow list if needed
   *
   * @param {String} domain Domain to add
   * @param {String} action The heuristic action to take
   */
  setupUserAction: function(domain, action){
    var index = badger.userAllow.indexOf(domain);
    if (index > -1 && action !== constants.USER_ALLOW) {
      badger.userAllow.splice(index, 1);
    } else if (index <= -1 && action === constants.USER_ALLOW) {
      badger.userAllow.push(domain);
    }

    this._setupDomainAction(domain, action, "userAction");
  },

  /**
   * Remove user set action from a domain and remove it from userAllow
   * list in case it was previously allowed by user
  * @param domain FQDN string
  **/
  revertUserAction: function(domain){
    this._setupDomainAction(domain, "", "userAction");

    var index = badger.userAllow.indexOf(domain);
    if (index > -1) {
      badger.userAllow.splice(index, 1);
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
 **/

/**
 * BadgerStorage constructor
 * *DO NOT USE DIRECTLY* Instead call `getBadgerStorageObject(name)`
 * @param {String} name - the name of the storage object
 * @param {Object} seed - the base object which we are instantiating from
 * @return {BadgerStorage} an existing BadgerStorage object or an empty new object
 **/
var BadgerStorage = function(name, seed){
  this.name = name;
  this._store = seed;
};

BadgerStorage.prototype = {
  /**
   * Check if this storage object has an item
   *
   * @param {String} key - the key for the item
   * @return boolean
   **/
  hasItem: function(key){
    var self = this;
    return self._store.hasOwnProperty(key);
  },

  /**
   * Get an item
   *
   * @param {String} key - the key for the item
   * @return the value for that key or null
   **/
  getItem: function(key) {
    var self = this;
    if(self.hasItem(key)){
      return self._store[key];
    } else {
      return null;
    }
  },

  /**
   * Get all items in the object as a copy
   *
   * #return {*} the items in badgerObject
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
   **/
  setItem: function(key,value){
    var self = this;
    self._store[key] = value;
    // Async call to syncStorage.
    setTimeout(function(){
      _syncStorage(self);
    }, 0);
  },

  /**
   * Delete an item
   *
   * @param {String} key - the key for the item
   **/
  deleteItem: function(key){
    var self = this;
    delete self._store[key];
    // Async call to syncStorage.
    setTimeout(function(){
      _syncStorage(self);
    }, 0);
  },

  /**
   * Update the entire object that this instance is storing
   */
  updateObject: function(object){
    var self = this;
    self._store = object;
    // Async call to syncStorage.
    setTimeout(function(){
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
  merge: function(mapData) {
    var self = this;

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
        // Overwrite local setting (if exists) for any imported domain
        self._store[domain] = mapData[domain];
      }
    } else if (self.name === "snitch_map") {
      for (let tracker_fqdn in mapData) {
        var firstPartyOrigins = mapData[tracker_fqdn];
        for (let origin in firstPartyOrigins) {
          badger.heuristicBlocking.updateTrackerPrevalence(
            tracker_fqdn,
            firstPartyOrigins[origin]
          );
        }
      }
    }

    // Async call to syncStorage.
    setTimeout(function(){
      _syncStorage(self);
    }, 0);
  }
};

var _syncStorage = (function () {
  var debouncedFuncs = {};

  function sync(badgerStorage) {
    var obj = {};
    obj[badgerStorage.name] = badgerStorage._store;
    chrome.storage.local.set(obj);
  }

  // Creates debounced versions of "sync" function,
  // one for each distinct badgerStorage value.
  return function (badgerStorage) {
    if (!debouncedFuncs.hasOwnProperty(badgerStorage.name)) {
      debouncedFuncs[badgerStorage.name] = _.debounce(function () {
        sync(badgerStorage);
      });
    }
    debouncedFuncs[badgerStorage.name]();
  };
}());

/************************************** exports */
var exports = {};

exports.BadgerPen = BadgerPen;

return exports;
/************************************** exports */
})();
