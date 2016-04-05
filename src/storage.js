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

var exports = {};

/**
 * snitch_map is our collection of potential tracking base_domains 
 * it looks like this:
 * { 
 *   "third.party.com": ["a.com", "b.com", "c.com"], 
 *   "eviltracker.net": ["eff.org", "a.com"]
 * }
 *
 * action_map is where we store the action for each domain that we have 
 * decided on an action for. Each subdomain gets its own entry. For example:
 * {
 *   "google.com": "blocked",
 *   "fonts.google.com": "cookieblocked"
 *   "apis.google.com": "user_block",
 *   "widget.eff.org": "dnt"
 * }
 *
 * cookieblock_list is where we store the current cookie block list as 
 * downloaded from eff.org. The keys are the domains which should be blocked.
 * The values are simply 'true'
 *
 * { 
 *   "maps.google.com": true,
 *   "creativecommons.org": true,
 *   ...
 * }
 **/
var storage_objects = [
  "snitch_map",
  "action_map",
  "dnt_domains",
  "cookieblock_list"
];

var snitch_map = getBadgerStorageObject("snitch_map");
var action_map = getBadgerStorageObject("action_map");
var cookieblock_list = getBadgerStorageObject("cookieblock_list");
var dnt_domains = getBadgerStorageObject("dnt_domains");


/** 
 * find the action to take for an FQDN, traverses the action list for the
 * fqdn and each of its subdomains and then takes the most appropriate
 * action
 * @param {String} fqdn the FQDN we want to determine the action for
 * @returns {String} the best action for the FQDN
 **/
var checkAction = function(fqdn) {
  // TODO
};


/**
 * Checks if a given FQDN is tracking. Update snitch_map 
 * and action_map accordingly
 * @param {String} fqdn the FQDN we should check tracking on
 * @returns boolean whether the status changed for the FQDN
 **/
var checkTracking = function(fqdn) {
  // TODO
};

/**
 * Update the cookie block list with a new list 
 * add any new entries that already have a parent domain in the action_map
 * and remove any old entries that are no longer in the cookie block list 
 * from the action map
 **/
var updateCookieBlockList = function(new_list){
  // TODO
};

/**
 * A factory for getting BadgerStorage objects, this will either get a badger 
 * storage object from the cache or return a new BadgerStorage object. 
 * @param {String} key the name of the stored object
 * @return {BadgerStorage} A badgerStorage object 
 **/
 
var getBadgerStorageObject = function(key) {
  // TODO: What is our storage backend going to be? it should probably be 
  // local storage which is then maybe zipped and sent over google sync?
  // We should also be looking out for private storage
  return new BadgerStorage(key);
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
 * @return {BadgerStorage} an existing BadgerStorage object or an empty new object
 **/
var BadgerStorage = function(name){
  this.name = name;
  this.private = false;
};

BadgerStorage.prototype = {

  /**
   * check if this storage object has an item 
   * @param {String} key the key for the item
   * @return boolean 
   **/
  hasItem: function(key){
  },

  /**
   * get an item
   * @param {String} key the key for the item
   * @return {Mixed} the value for that key or null 
   **/
  getItem: function(key) {
  },

  /**
   * set an item
   * @param {String} key the key for the item
   **/
  setItem: function(key,value){
  },

  /**
   * delete an item
   * @param {String} key the key for the item
   **/
  deleteItem: function(key){
  },
};

exports.checkAction = checkAction;
exports.checkTracking = checkTracking;
exports.updateCookieBlockList = updateCookieBlockList;

});

