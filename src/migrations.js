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

  migrateLegacyFirefoxData: function(badger){
    if(!window.legacyStorage){
      console.log("No legacy firefox data found. Nothing to migrate");
      return; 
    }

    console.log('MIGRATING FIREFOX DATA', window.legacyStorage);

    var originFrequency = window.legacyStorage.originFrequency;
    var disabledSites = window.legacyStorage.disabledSites;
    var policyWhitelist = window.legacyStorage.policyWhitelist;
    var userGreen = window.legacyStorage.userGreen;
    var userYellow = window.legacyStorage.userYellow;
    var userRed = window.legacyStorage.userRed;

    // Import snitch map 
    _.each(originFrequency, function(fpDomains, trackingDomain){
      _.each(fpDomains, function(v, firstParty){
        badger.heuristicBlocking.recordPrevalence(trackingDomain, firstParty);
      });
    });

    // Import action map
    _.each(userGreen, function(v, domain){
      badger.storage.setupUserAction(domain, constants.USER_ALLOW);
    });

    _.each(userYellow, function(v, domain){
      badger.storage.setupUserAction(domain, constants.USER_COOKIE_BLOCK);
    });
    
    _.each(userRed, function(v, domain){
      badger.storage.setupUserAction(domain, constants.USER_BLOCK);
    });

    _.each(policyWhitelist, function(v, domain){
      badger.checkForDNTPolicy(domain, 0);
    });

    // Import disabled sites and set seen comic flag
    _.each(disabledSites, function(v, domain){
      badger.disablePrivacyBadgerForOrigin(domain);
    });

    var settings = badger.storage.getBadgerStorageObject("settings_map");
    settings.setItem("seenComic", true);

    // Cleanup
    chrome.storage.local.remove(Object.keys(window.legacyStorage), function(){
      console.log("Finished migrating storage. Cleaned up on my way out.");
    });
     
  },

};



return exports;
})(); //require scopes
