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

var utils = require("utils");
var constants = require("constants");

require.scopes.migrations = (function() {

var exports = {};
exports.Migrations= {
  changePrivacySettings: function() {
    if (!chrome.extension.inIncognitoContext && chrome.privacy ) {
      console.log('changing privacy settings');
      chrome.privacy.services.alternateErrorPagesEnabled.set({'value': false, 'scope': 'regular'});
      chrome.privacy.websites.hyperlinkAuditingEnabled.set({'value': false, 'scope': 'regular'});
    }
  },

  migrateAbpToStorage: function () {},

  migrateBlockedSubdomainsToCookieblock: function(badger){
    setTimeout(function(){
      console.log('MIGRATING BLOCKED SUBDOMAINS THAT ARE ON COOKIE BLOCK LIST');
      var cbl = badger.storage.getBadgerStorageObject('cookieblock_list');
      _.each(badger.storage.getAllDomainsByPresumedAction(constants.BLOCK), function(fqdn){
        _.each(utils.explodeSubdomains(fqdn, true), function(domain){
          if(cbl.hasItem(domain)){
            console.log('moving', fqdn, 'from block to cookie block');
            badger.storage.setupHeuristicAction(fqdn, constants.COOKIEBLOCK);
          }
        });
      });
    }, 1000 * 30);
  },

  migrateLegacyFirefoxData: function(){ },

  migrateDntRecheckTimes: function(badger){
    var action_map = badger.storage.getBadgerStorageObject('action_map');
    for(var domain in action_map.getItemClones()){
      if(badger.storage.getNextUpdateForDomain(domain) === 0){
        // Recheck at a random time in the next week
        var recheckTime = utils.getRandom(Date.now(), Date.now() + (utils.oneDay() * 7));
        badger.storage.touchDNTRecheckTime(domain, recheckTime);
      }
    }

  },

};



return exports;
})(); //require scopes
