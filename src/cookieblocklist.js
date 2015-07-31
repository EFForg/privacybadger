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
  domains: {},
  loaded: false,

  updateDomains: function(){
    var _this = this;
    self.domains = JSON.parse(localStorage.getItem("cookieblocklist"));
    _this.loaded = true;
    return;
  },

  /**
   * Add a domain to the local blocklist
   * @param {String} domain The domain to add to the local blocklist
   * @param {Function} cb The callback to call (optional)
   */
  addDomain: function(domain){
    if (!this.loaded){
      this.updateDomains();
    }
    if(!this.hasDomain(domain)){
      this.domains[domain] = true;
      localStorage.setItem("cookieblocklist", JSON.stringify(this.domains));
    }
  },

  /**
   * Remove a domain from the local blocklist. Stores in localStorage
   * @param {String} domain to remove
   */
  removeDomain: function(domain){
    if(!this.loaded){
      this.updateDomains();
    }
    if(this.hasDomain(domain)){
      delete this.domains[domain];
      localStorage.setItem("cookieblocklist", JSON.stringify(this.domains));
    }
  },

  /**
   * Checks if a domain is in the block list
   * @param {String} domain The domain to check for
   * @returns {boolean} true if found
   */
  hasDomain: function(domain){
    return this.domains.hasOwnProperty(domain);
  },
};
return exports;
})(); //require scopes
