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
 /* globals localStorage, setTimeout, console, NO_TRACKING, ALLOW, BLOCK, COOKIEBLOCK, DNT, NO_TRACKING */

var Utils = require("utils").Utils;
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


var initialize = function(){
  console.log('loading badgers into the pen');
  var storage_objects = [
    "snitch_map",
    "action_map",
    "dnt_domains",
    "cookieblock_list"
  ];

  for(var i = 0; i < storage_objects.length; i++){
    _initializeCache(storage_objects[i]);
  }
  console.log('loaded', storage_objects.length, 'badgers');
};

var getScore = function(action){
  switch(action){
    case NO_TRACKING: return 0;
    case ALLOW: return 1;
    case BLOCK: return 2;
    case COOKIEBLOCK: return 3;
    case DNT: return 4;
    default: return 5; 
  }
};

/**
 * get the current presumed action for a specific fqdn, ignoring any rules for subdomains
 * below or above it
 * @param {Object} domain domain object from action_map
 * @returns {String} the presumed action for this FQDN
 **/
var getActionForFqdn = function(domain){
  if(domain.userAction){ return domain.userAction; }
  if(domain.dnt){ return DNT; } 
  if(domain.heuristicAction){ return domain.heuristicAction; } 
  return NO_TRACKING;
};

/**
 * remove user set action from a domain
 * @param {Object} domain domain object from action_map
 **/
var revertUserAction = function(domain){
    domain.userAction = null;
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
  var best_action = NO_TRACKING;
  var subdomains = Utils.explodeSubdomains(fqdn);
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
    if(getScore(action) > getScore(best_action)){
      best_action = action;
    }
  }

  return best_action;
};


/**
 * Checks if a given FQDN is tracking. Update snitch_map 
 * and action_map accordingly
 * @param {String} fqdn the FQDN we should check tracking on
 * @returns boolean whether the status changed for the FQDN
 **/
var checkTracking = function(fqdn) {
  // TODO
  throw('nope!' + fqdn);
};

/**
 * Update the cookie block list with a new list 
 * add any new entries that already have a parent domain in the action_map
 * and remove any old entries that are no longer in the cookie block list 
 * from the action map
 **/
var updateCookieBlockList = function(new_list){
  // TODO yes
  throw('nope!' + new_list);
};

/**
 * A factory for getting BadgerStorage objects, this will either get a badger 
 * storage object from the cache or return a new BadgerStorage object. 
 * @param {String} key the name of the stored object
 * @return {BadgerStorage} A badgerStorage object 
 **/
 
var getBadgerStorageObject = function(key) {
  // TODO Handle incognito mode, store only in memory;

  if(badgerPen.hasOwnProperty(key)){
    console.log('fetching', key, 'from memory');
    return badgerPen[key];
  }
  console.error('initializing cache from getBadgerStorageObject. You are using this API improperly');
  return _initializeCache(key);
};

var _initializeCache = function(key) {

  // now check localStorage
  var json_str = localStorage.getItem(key);
  if(json_str === null){
    json_str = "{}";
    localStorage.setItem(key, json_str);
  }

  var storage_obj = new BadgerStorage(key, JSON.parse(json_str));
  badgerPen[key] = storage_obj;
  
  return storage_obj;
};

// Cache of BadgerStorage objects
var badgerPen = {};

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
    return !!self._store.hasOwnProperty(key);
  },

  /**
   * get an item
   * @param {String} key the key for the item
   * @return {Mixed} the value for that key or null 
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
   * set an item
   * @param {String} key the key for the item
   * @param {String} value the new value
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

  getSerialized: function(){
    return JSON.stringify(this._store);
  }
};

var _syncStorage = function(badger){
  var stored = badger.getSerialized();
  localStorage.setItem(badger.name, stored);
};

var exports = {};

exports.getBestAction = getBestAction;
exports.getActionForFqdn = getActionForFqdn;
exports.checkTracking = checkTracking;
exports.updateCookieBlockList = updateCookieBlockList;
exports.getBadgerStorageObject = getBadgerStorageObject;
exports.revertUserAction = revertUserAction;
exports.initialize = initialize;

return exports;
/************************************** exports */
})();
