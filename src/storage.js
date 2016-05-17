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

// Cache of BadgerStorage objects
var badgerPen = {};


var initialize = function(callback){
  console.log('loading badgers into the pen');
  var storage_objects = [
    "snitch_map",
    "action_map",
    "cookieblock_list",
    "supercookie_domains",
    "dnt_hashes",
    "settings_map"
  ];

  _initializeCache(storage_objects, callback);
};

var getScore = function(action){
  switch(action){
    case pb.NO_TRACKING: return 0;
    case pb.ALLOW: return 1;
    case pb.BLOCK: return 2;
    case pb.COOKIEBLOCK: return 3;
    case pb.DNT: return 4;
    default: return 5; 
  }
};

/**
 * get the current presumed action for a specific fqdn, ignoring any rules for subdomains
 * below or above it
 * @param {Object|String} domain domain object from action_map
 * @returns {String} the presumed action for this FQDN
 **/
var getActionForFqdn = function(domain){
  if (_.isString(domain)) {
    domain = getBadgerStorageObject('action_map').getItem(domain) || {};
  }
  if(domain.userAction){ return domain.userAction; }
  if(domain.dnt){ return pb.DNT; } 
  if(domain.heuristicAction){ return domain.heuristicAction; } 
  return pb.NO_TRACKING;
};

/**
 * adds a heuristic action for a domain
 * @param {String} domain Domain to add
 * @param {String} action The heuristic action to take
 */
var setupHeuristicAction = function(domain, action){
  _setupDomainAction(domain, action, "heuristicAction");
};

/**
 * Sets up a domain for DNT
 * @param {String} domain Domain to add
 */
var setupDNT = function(domain){
  _setupDomainAction(domain, true, "dnt"); 
};
  
/**
* remove DNT setting from a domain
* @param domain FQDN string
**/
var revertDNT = function(domain){
  _setupDomainAction(domain, false, "dnt");
};

var touchDNTRecheckTime = function(domain, time){
  var action_map = getBadgerStorageObject('action_map');
  var domainObj = action_map.getItem(domain);
  domainObj.nextUpdateTime = time;
  action_map.setItem(domain, domainObj);
};

var getNextUpdateForDomain = function(domain){
  var action_map = getBadgerStorageObject('action_map');
  if(action_map.hasItem(domain)){
    return action_map.getItem(domain).nextUpdateTime;
  } else {
    return 0;
  }
};

/**
 * update DNT policy hashes
 */
var updateDNTHashes = function(hashes){
  var dnt_hashes = getBadgerStorageObject('dnt_hashes');
  dnt_hashes.updateObject(_.invert(hashes));
};

/**
 * adds a heuristic action for a domain
 * @param {String} domain Domain to add
 * @param {String} action The heuristic action to take
 */
var setupUserAction = function(domain, action){
  _setupDomainAction(domain, action, "userAction");
};
  
/**
* remove user set action from a domain
* @param domain FQDN string
**/
var revertUserAction = function(domain){
  _setupDomainAction(domain, "", "userAction");
};

  
/**
 * set up an action for a domain of the given action type in action_map
 * @param domain the domain to set the action for
 * @param action the action to take e.g. BLOCK || COOKIEBLOCK || DNT
 * @param actionType the type of action we are setting, one of "userAction", "heuristicAction", "dnt"
 * @private
 */
var _setupDomainAction = function(domain, action, actionType){
  var action_map = getBadgerStorageObject("action_map");
  var actionObj = {};
  if (action_map.hasItem(domain)) {
    actionObj = action_map.getItem(domain);
  } else {
    actionObj = _newActionMapObject();
  }
  actionObj[actionType] = action;
  action_map.setItem(domain, actionObj);
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
 * find the best action to take for an FQDN, assuming it is third party and 
 * privacy badger is enabled. Traverses the action list for the
 * fqdn and each of its subdomains and then takes the most appropriate
 * action
 * @param {String} fqdn the FQDN we want to determine the action for
 * @returns {String} the best action for the FQDN
 **/
var getBestAction = function(fqdn) {
  var best_action = pb.NO_TRACKING;
  var subdomains = pb.utils.explodeSubdomains(fqdn);
  var action_map = getBadgerStorageObject('action_map');
  var relevantDomains = [];
  var i;

  for( i = 0; i < subdomains.length; i++ ){
    if(action_map.hasItem(subdomains[i])){
      // First collect the actions for any domains or subdomains of the fqdn
      // Order from base domain to FQDN
      relevantDomains.unshift(action_map.getItem(subdomains[i]));
    }
  }

  // Loop through each subdomain we have a rule for from least to most specific
  // and keep the one which has the best score. 
  for( i = 0; i < relevantDomains.length; i++ ){
    var action = getActionForFqdn(relevantDomains[i]);
    if(getScore(action) >= getScore(best_action)){
      best_action = action;
    }
  }

  return best_action;
};

/**
 * Find every domain in the action_map where the presumed acttion would be {action}
 * @param {String} selector the action to select by
 * @return {Array} an array of FQDN strings
 **/
var getAllDomainsByPresumedAction = function(selector){
  var action_map = getBadgerStorageObject('action_map');
  var relevantDomains = [];
  for(var domain in action_map.getItemClones()){
    if(selector == getActionForFqdn(domain)){
      relevantDomains.push(domain); 
    }
  }
  return relevantDomains;
};

/**
 * Get the number of domains that the given FQDN has been seen tracking on
 * @param fqdn domain to check status of
 * @return int the number of domains fqdn has been tracking on 
 */
var getTrackingCount = function(fqdn){
  var snitch_map = getBadgerStorageObject('snitch_map');
  if(snitch_map.hasItem(fqdn)){
    return snitch_map.getItem(fqdn).length;
  } else {
    return 0;
  }
};

/**
 * A factory for getting BadgerStorage objects, this will either get a badger 
 * storage object from the cache or return a new BadgerStorage object. 
 * @param {String} key the name of the stored object
 * @return {BadgerStorage} A badgerStorage object 
 **/
 
var getBadgerStorageObject = function(key) {

  if(badgerPen.hasOwnProperty(key)){
    return badgerPen[key];
  }
  console.error('cant initialize cache from getBadgerStorageObject. You are using this API improperly');
};

var _initializeCache = function(keys, cb) {

  // now check localStorage
  chrome.storage.local.get(keys, function(store){
    _.each(keys, function(key){
      if(store.hasOwnProperty(key)){
        badgerPen[key] = new BadgerStorage(key, store[key]);
      } else {
        var storage_obj = new BadgerStorage(key, {});
        badgerPen[key] = storage_obj;
        _syncStorage(storage_obj);
      }
    });
    if(_.isFunction(cb)){
      cb();
    }
  });
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
 * @param {String} name the name of the storage object
 * @param {Object} seed the base object which we are instantiating from
 * @return {BadgerStorage} an existing BadgerStorage object or an empty new object
 **/
var BadgerStorage = function(name, seed){
  this.name = name;
  this._store = seed;
};

BadgerStorage.prototype = {

  /**
   * check if this storage object has an item 
   * @param {String} key the key for the item
   * @return boolean 
   **/
  hasItem: function(key){
    var self = this;
    return self._store.hasOwnProperty(key);
  },

  /**
   * get an item
   * @param {String} key the key for the item
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
   * get all items in the object as a copy
   * #return {*} the items in badgerObject
   */
  getItemClones: function() {
    var self = this;
    return JSON.parse(JSON.stringify(self._store));
  },

  /**
   * set an item
   * @param {String} key the key for the item
   * @param {*} value the new value
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
   * delete an item
   * @param {String} key the key for the item
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
  updateObject: function(objekt){
    var self = this;
    self._store = objekt;
    // Async call to syncStorage.
    setTimeout(function(){
      _syncStorage(self);
    }, 0);
  }
};

var _syncStorage = function(badger){
  if(chrome.extension.inIncognitoContext) { return; }
  var obj = {};
  obj[badger.name] = badger._store;
  chrome.storage.local.set(obj);
};

/************************************** exports */
var exports = {};

exports.getBestAction = getBestAction;
exports.getActionForFqdn = getActionForFqdn;
exports.getAllDomainsByPresumedAction = getAllDomainsByPresumedAction;
exports.getNextUpdateForDomain = getNextUpdateForDomain;
exports.setupHeuristicAction = setupHeuristicAction;
exports.setupDNT = setupDNT;
exports.revertDNT = revertDNT;
exports.updateDNTHashes = updateDNTHashes;
exports.touchDNTRecheckTime = touchDNTRecheckTime;
exports.setupUserAction = setupUserAction;
exports.revertUserAction = revertUserAction;
exports.getBadgerStorageObject = getBadgerStorageObject;
exports.getTrackingCount = getTrackingCount;
exports.initialize = initialize;

return exports;
/************************************** exports */
})();
