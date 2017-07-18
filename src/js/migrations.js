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
      if (chrome.privacy.services && chrome.privacy.services.alternateErrorPagesEnabled) {
        chrome.privacy.services.alternateErrorPagesEnabled.set({'value': false, 'scope': 'regular'});
      }
      if (chrome.privacy.websites && chrome.privacy.websites.hyperlinkAuditingEnabled) {
        chrome.privacy.websites.hyperlinkAuditingEnabled.set({'value': false, 'scope': 'regular'});
      }
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
        var recheckTime = utils.getRandom(Date.now(), utils.nDaysFromNow(7));
        badger.storage.touchDNTRecheckTime(domain, recheckTime);
      }
    }

  },
  
  // Fixes https://github.com/EFForg/privacybadger/issues/1181
  migrateDntRecheckTimes2: function(badger){
    console.log('fixing DNT check times');
    var action_map = badger.storage.getBadgerStorageObject('action_map');
    for(var domain in action_map.getItemClones()){
      // Recheck at a random time in the next week
      var recheckTime = utils.getRandom(utils.oneDayFromNow(), utils.nDaysFromNow(7));
      badger.storage.touchDNTRecheckTime(domain, recheckTime);
    }
  },

  forgetMistakenlyBlockedDomains: function (badger) {
    console.log("Running migration to forget mistakenly flagged domains ...");

    let MISTAKES = [
      'akamaized.net',
      'bootcss.com',
      'edgesuite.net',
      'ehowcdn.com',
      'ewscloud.com',
      'fncstatic.com',
      'hgmsites.net',
      'hsforms.net',
      'hubspot.com',
      'jsdelivr.net',
      'kinja-img.com',
      'kxcdn.com',
      'ldwgroup.com',
      'metapix.net',
      'optnmstr.com',
      'parastorage.com',
      'polyfill.io',
      'qbox.me',
      'rfdcontent.com',
      'scene7.com',
      'sinaimg.cn',
      'slidesharecdn.com',
      'staticworld.net',
      'taleo.net',
      'techhive.com',
      'unpkg.com',
      'uvcdn.com',
      'washingtonpost.com',
      'wixstatic.com',
      'ykimg.com',
    ];

    let action_map = badger.storage.getBadgerStorageObject("action_map"),
      snitch_map = badger.storage.getBadgerStorageObject("snitch_map");

    // remove from action map
    let actions = action_map.getItemClones();
    for (let domain in actions) {
      for (let i = 0; i < MISTAKES.length; i++) {
        if (domain.endsWith(MISTAKES[i])) {
          // remove only if domain was seen tracking
          // and user did not set an override
          if (actions[domain].userAction == "" && (
            actions[domain].heuristicAction == constants.ALLOW ||
            actions[domain].heuristicAction == constants.BLOCK ||
            actions[domain].heuristicAction == constants.COOKIEBLOCK
          )) {
            action_map.deleteItem(domain);
          }
        }
      }
    }

    // remove from snitch map
    for (let domain in snitch_map.getItemClones()) {
      for (let i = 0; i < MISTAKES.length; i++) {
        if (domain.endsWith(MISTAKES[i])) {
          snitch_map.deleteItem(domain);
        }
      }
    }
  },

  unblockBlockedDomainsOnYellowlist: function (badger) {
    console.log("Running migration to unblock yellowlisted but blocked domains ...");

    let action_map = badger.storage.getBadgerStorageObject("action_map"),
      snitch_map = badger.storage.getBadgerStorageObject("snitch_map"),
      ylist = badger.storage.getBadgerStorageObject("cookieblock_list"),
      ylist_domains = Object.keys(ylist.getItemClones());

    // for every blocked domain
    for (let domain in action_map.getItemClones()) {
      if (action_map.getItem(domain).heuristicAction != constants.BLOCK) {
        continue;
      }

      let base_domain = window.getBaseDomain(domain);

      // see if the domain ends with any yellowlisted domains
      if (_.some(ylist_domains, ydomain => domain.endsWith(ydomain))) {
        // OK, we have a potentially incorrectly blocked domain

        // what should we set the domain to instead?
        // let's check snitch map ...
        let sites = snitch_map.getItem(base_domain);

        // "no tracking" (not constants.NO_TRACKING to match current behavior)
        let action = "";

        if (sites && sites.length) {
          if (sites.length >= constants.TRACKING_THRESHOLD) {
            // tracking domain over threshold, set it to cookieblock or block
            badger.heuristicBlocking.blacklistOrigin(base_domain, domain);
            continue;
          } else {
            // tracking domain below threshold
            action = constants.ALLOW;
          }
        }

        badger.storage.setupHeuristicAction(domain, action);
      }
    }
  },

};



return exports;
})(); //require scopes
