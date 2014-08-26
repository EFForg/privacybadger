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

  //minimum and max amount of time before we check again for dnt-policy
  minThreshold: 86400000, //1 day
  maxThreshold: 604800000, //1 week

  updateDomains: function(){
    var self = this;
    chrome.storage.local.get('blockeddomainlist', function(items){
      if(chrome.runtime.lastError || !items.blockeddomainlist){
        //blocked domain list has never been set so we initialize it with an empty array
        chrome.storage.local.set({blockeddomainlist: self.domains});
        return;
      }
      self.domains = items.blockeddomainlist;
    });
  },

  addDomain: function(domain, cb){
    if(!this.hasDomain(domain)){
      var updateTime = this._randomFutureTime();
      this.domains[domain] = updateTime;
      chrome.storage.local.set({blockeddomainlist: this.domains},function(){
        if(cb && typeof(cb) === "function"){
          cb();
        }
      });
    }
  },

  updateDomainCheckTime: function(domain){
    var updateTime = this._randomFutureTime();
    this.domains[domain] = updateTime;
    chrome.storage.local.set({blockeddomainlist: this.domains},function(){});
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
      chrome.storage.local.set({blockeddomainlist: this.domains});
    }
  },

  hasDomain: function(domain){
    return this.domains.hasOwnProperty(domain);
  },
};

return exports;
})();
