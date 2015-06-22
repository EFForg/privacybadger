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
require.scopes.blockedDomainList = (function() {

var exports = {};

var Utils = require('utils').Utils;

var BlockedDomainList = exports.BlockedDomainList = {
  domains: {},
  loaded: false,

  //minimum and max amount of time before we check again for dnt-policy
  minThreshold: 86400000, //1 day
  maxThreshold: 604800000, //1 week

  /**
   * Load blocked domains from localStorage
   */
  updateDomains: function(){
    var self = this;
    self.domains = JSON.parse(localStorage.getItem("blockeddomainslist"));
    this.loaded = true;
    return;
  },

  /**
   * Adds a domain and stores the data in localStorage
   * @param {String} domain The domain to add
   * @param {Function} cb Callback, not used
   */
  addDomain: function(domain, cb){
    if(!this.loaded){
      this.updateDomains();
    }
    if(!this.hasDomain(domain)){
      var updateTime = this._randomFutureTime();
      this.domains[domain] = updateTime;
      localStorage.setItem("blockeddomainslist", JSON.stringify(this.domains));
    }
  },

  /**
   * Generates a new domain check time for the given domain
   * @param {String} domain The domain to update
   */
  updateDomainCheckTime: function(domain){
    if(!this.loaded){
      this.updateDomains();
    }
    var updateTime = this._randomFutureTime();
    this.domains[domain] = updateTime;
    localStorage.setItem("blockeddomainslist", JSON.stringify(this.domains));
  },

  /**
   * Returns the DB entry (update time) for a given domain
   * @param {String} domain The domain to find
   * @returns {*}
   */
  nextUpdateTime: function(domain){
    return this.domains[domain];
  },

  /**
   * Generates a random time in the future, between +minThreshold and +maxThreshold
   * @returns {Date} The generated time
   * @private
   */
  _randomFutureTime: function(){
    return Date.now() + Utils.getRandom(this.minThreshold, this.maxThreshold);
  },

  /**
   * Removes the given domain
   * @param {String} domain the domain to remove
   */
  removeDomain: function(domain){
    if(!this.loaded){
      this.updateDomains();
    }
    if(this.hasDomain(domain)){
      delete this.domains[domain];
      localStorage.setItem("blockeddomainslist", JSON.stringify(this.domains));
    }
  },

  /**
   * Check if a specific domain exists in the DB
   * @param domain The domain to check for
   * @returns {Boolean} true if the property exists
   */
  hasDomain: function(domain){
    return this.domains.hasOwnProperty(domain);
  },
};

return exports;
})();
