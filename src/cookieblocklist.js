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
require.scopes.cookieblocklist = (function() {

var exports = {};
var Utils   = require('utils').Utils;

var CookieBlockList = exports.CookieBlockList = {
  domains: [],

  updateDomains: function(){
    var _this = this;

    chrome.storage.local.get('cookieblocklist', function(items){
      if(chrome.runtime.lastError || !items.cookieblocklist){
        //cookie block list has never been set so we initialize it with an empty array
        chrome.storage.local.set({cookieblocklist: _this.domains});
        return;
      }
      _this.domains = items.cookieblocklist;
    });
  },

  /**
   * Add a domain to the local blocklist
   * @param {String} domain The domain to add to the local blocklist
   * @param {Function} cb The callback to call (optional)
   */
  addDomain: function(domain, cb){
    if(!this.hasDomain(domain)){
      this.domains.push(domain);
      chrome.storage.local.set({cookieblocklist: this.domains},function(){
        if(cb && typeof(cb) === "function"){
          cb();
        }
      });
    }
  },

  /**
   * Remove a domain from the local blocklist. Stores in localStorage
   * @param {String} domain to remove
   */
  removeDomain: function(domain){
    if(this.hasDomain(domain)){
      Utils.removeElementFromArray(this.domains,this.domains.indexOf(domain));
      chrome.storage.local.set({cookieblocklist: this.domains});
    }
  },

  /**
   * Checks if a domain is in the block list
   * @param {String} domain The domain to check for
   * @returns {boolean} true if found
   */
  hasDomain: function(domain){
    var idx = this.domains.indexOf(domain);

    if(idx < 0){
      return false;
    } else {
      return true;
    }
  },


  /**
   * Checks if a base domain is in the blocklist
   * @param {String} baseDomain The base domain to compare to
   * @returns {boolean} true if base domain found
   */
  hasBaseDomain: function(baseDomain){
    for(var i = 0; i < this.domains.length; i++){
      if(getBaseDomain(this.domains[i]) == baseDomain){
        return true;
      }
    }
    return false;
  }
};
return exports;
})(); //require scopes
