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
var background = chrome.extension.getBackgroundPage();

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

var snitch_map = _getStorageItem(snitch_map, {});
var action_map = _getStorageItem(action_map, {});
var cookieblock_list = _getStorageItem(cookieblock_list, {});


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
 * An abstraction for dealing with the underlying storage engine, either
 * chrome.storage or localStorage or something else.
 * gets an item from storage
 * @param {String} key the name of the stored object
 * @param {Object} default_value the name of the stored object
 * @return {Object} the stored value or a default value
 **/
var _getStorageItem = function(key, default_value) {
  // TODO: What is our storage backend going to be? it should probably be 
  // local storage which is then maybe zipped and sent over google sync?
};

/**
 * An abstraction for dealing with the underlying storage engine, either
 * chrome.storage or localStorage or something else.
 * updates an item in storage
 * @param {String} key the key to update
 * @param {Object} value the new value
 **/
var _setStorageItem = function(key, value){
  // TODO: What is our storage backend going to be? it should probably be 
  // local storage which is then maybe zipped and sent over google sync?
};

exports.checkAction = checkAction;
exports.checkTracking = checkTracking;
exports.updateCookieBlockList = updateCookieBlockList;

});

