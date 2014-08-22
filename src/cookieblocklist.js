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

  removeDomain: function(domain){
    if(this.hasDomain(domain)){
      Utils.removeElementFromArray(this.domains,this.domains.indexOf(domain));
      chrome.storage.local.set({cookieblocklist: this.domains});
    }
  },

  hasDomain: function(domain){
    var idx = this.domains.indexOf(domain);

    if(idx < 0){
      return false;
    } else {
      return true;
    }
  },

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
