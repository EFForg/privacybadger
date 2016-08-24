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

  migrateAbpToStorage: function(){
    return _.noop();
    /*
    ABP migration code, no longer needed, kept for historical purposes. 
    if(!localStorage.seenThirdParties) { return; } //We do not have any ABP data 
    console.log('migrating data out of ABP');

    var FilterStorage = require("filterStorage").FilterStorage;

    var getDomainFromFilter = function(filter){
      return filter.match('[|][|]([^\^]*)')[1];
    };

    var settings = pbStorage.getBadgerStorageObject('settings_map'); 
    var snitch_map = pbStorage.getBadgerStorageObject('snitch_map');
    var cookieblock_list = pbStorage.getBadgerStorageObject('cookieblock_list');
    var supercookie_domains = pbStorage.getBadgerStorageObject('supercookie_domains');

    // migrate settings
    if(localStorage.socialWidgetReplacementEnabled){
      settings.setItem('socialWidgetReplacementEnabled', JSON.parse(localStorage.socialWidgetReplacementEnabled));
    }
    if(localStorage.showCounter){
      settings.setItem('showCounter', JSON.parse(localStorage.showCounter));
    }
    if(localStorage.seenComic){
      settings.setItem('seenComic', JSON.parse(localStorage.seenComic));
    }
    if(localStorage.disabledSites){
      settings.setItem('disabledSites', JSON.parse(localStorage.disabledSites));
    }
    settings.setItem('isFirstRun', false);

    //migrate snitch_map
    try {
      var seenThirdParties = JSON.parse(localStorage.seenThirdParties);
      var oldSeen = {};
      _.each(seenThirdParties, function(val , key){
        oldSeen[key] = _.keys(val);
        pbStorage.setupHeuristicAction(key, constants.ALLOW);
      });
      snitch_map.updateObject(oldSeen);
    } catch (e) {
      console.log(e);
    }


    // migrate supercookie_domains
    try {
      supercookie_domains.updateObject(JSON.parse(localStorage.supercookieDomains));
    } catch (e) {
      console.log(e);
    }

    // setup cookieblock list
    try {
      var tmp_cbl = {};
      _.each(FilterStorage.knownSubscriptions["https://www.eff.org/files/cookieblocklist.txt"].filters, function(filter){
        var domain = getDomainFromFilter(filter.text);
        tmp_cbl[domain] = true;
      });
      cookieblock_list.updateObject(tmp_cbl);
    } catch (e) {
      console.log(e);
    }
    
    // Migrate action_map
    try {
      _.each(FilterStorage.knownSubscriptions.frequencyHeuristic.filters, function(filter){
        var domain = getDomainFromFilter(filter.text);
        var baseDomain = window.getBaseDomain(domain);
        heuristicBlocking.blacklistOrigin(baseDomain, domain);
      });
      _.each(FilterStorage.knownSubscriptions.userRed.filters, function(filter){
        var domain = getDomainFromFilter(filter.text);
        pbStorage.setupUserAction(domain, constants.USER_BLOCK);
      });
      _.each(FilterStorage.knownSubscriptions.userYellow.filters, function(filter){
        var domain = getDomainFromFilter(filter.text);
        pbStorage.setupUserAction(domain, constants.USER_COOKIE_BLOCK); });
      _.each(FilterStorage.knownSubscriptions.userGreen.filters, function(filter){
        var domain = getDomainFromFilter(filter.text);
        pbStorage.setupUserAction(domain, constants.USER_ALLOW);
      });
    } catch (e) {
      console.log(e);
    }

    // Migrate DNT domains
    if(localStorage.whitelisted){
      _.each(_.keys(JSON.parse(localStorage.whitelisted)), function(domain){
        pbStorage.setupDNT(domain);
      });
    }

    // remove local storage objects
    _.each(_.keys(localStorage), function(key){
      localStorage.removeItem(key);
    });

    // remove ABP subscriptions
    _.each(FilterStorage.subscriptions, function(sub){
      try {
        FilterStorage.removeSubscription(sub);
      } catch (e){
        console.error(e);
      }
    });


    console.log('ABP IS OVER!!!!');
    */
  },

  migrateBlockedSubdomainsToCookieblock(storage){
    setTimeout(function(){
      console.log('MIGRATING BLOCKED SUBDOMAINS THAT ARE ON COOKIE BLOCK LIST');
      var cbl = storage.getBadgerStorageObject('cookieblock_list');
      _.each(storage.getAllDomainsByPresumedAction(constants.BLOCK), function(fqdn){
        _.each(utils.explodeSubdomains(fqdn, true), function(domain){
          if(cbl.hasItem(domain)){
            console.log('moving', fqdn, 'from block to cookie block');
            storage.setupHeuristicAction(fqdn, constants.COOKIEBLOCK);
          }
        });
      });
    }, 1000 * 30);
  },

};



return exports;
})(); //require scopes
