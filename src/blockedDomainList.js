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

  updateDomains: function(){
    var self = this;
    self.domains = JSON.parse(localStorage.getItem("blockeddomainslist"));
    loaded = true;
    return;
  },

  addDomain: function(domain, cb){
    if(!this.hasDomain(domain)){
      var updateTime = this._randomFutureTime();
      this.domains[domain] = updateTime;
      localStorage.setItem("blockeddomainslist", JSON.stringify(this.domains));
    }
  },

  updateDomainCheckTime: function(domain){
    var updateTime = this._randomFutureTime();
    this.domains[domain] = updateTime;
    localStorage.setItem("blockeddomainslist", JSON.stringify(this.domains));
  },

  nextUpdateTime: function(domain){
    return this.domains[domain];
  },

  _randomFutureTime: function(){
    return Date.now() + Utils.getRandom(this.minThreshold, this.maxThreshold);
  },

  removeDomain: function(domain){
    if(this.hasDomain(domain)){
      delete this.domains[domain];
      localStorage.setItem("blockeddomainslist", JSON.stringify(this.domains));
    }
  },

  hasDomain: function(domain){
    return this.domains.hasOwnProperty(domain);
  },
};

return exports;
})();
