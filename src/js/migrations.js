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
    if (!chrome.extension.inIncognitoContext && chrome.privacy) {
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

  migrateBlockedSubdomainsToCookieblock: function(badger) {
    setTimeout(function() {
      console.log('MIGRATING BLOCKED SUBDOMAINS THAT ARE ON COOKIE BLOCK LIST');
      var cbl = badger.storage.getBadgerStorageObject('cookieblock_list');
      _.each(badger.storage.getAllDomainsByPresumedAction(constants.BLOCK), function(fqdn) {
        _.each(utils.explodeSubdomains(fqdn, true), function(domain) {
          if (cbl.hasItem(domain)) {
            console.log('moving', fqdn, 'from block to cookie block');
            badger.storage.setupHeuristicAction(fqdn, constants.COOKIEBLOCK);
          }
        });
      });
    }, 1000 * 30);
  },

  migrateLegacyFirefoxData: function() { },

  migrateDntRecheckTimes: function(badger) {
    var action_map = badger.storage.getBadgerStorageObject('action_map');
    for (var domain in action_map.getItemClones()) {
      if (badger.storage.getNextUpdateForDomain(domain) === 0) {
        // Recheck at a random time in the next week
        var recheckTime = _.random(Date.now(), utils.nDaysFromNow(7));
        badger.storage.touchDNTRecheckTime(domain, recheckTime);
      }
    }

  },

  // Fixes https://github.com/EFForg/privacybadger/issues/1181
  migrateDntRecheckTimes2: function(badger) {
    console.log('fixing DNT check times');
    var action_map = badger.storage.getBadgerStorageObject('action_map');
    for (var domain in action_map.getItemClones()) {
      // Recheck at a random time in the next week
      var recheckTime = _.random(utils.oneDayFromNow(), utils.nDaysFromNow(7));
      badger.storage.touchDNTRecheckTime(domain, recheckTime);
    }
  },

  forgetMistakenlyBlockedDomains: function (badger) {
    console.log("Running migration to forget mistakenly flagged domains ...");

    const MISTAKES = new Set([
      '2mdn.net',
      'akamaized.net',
      'bootcss.com',
      'cloudinary.com',
      'edgesuite.net',
      'ehowcdn.com',
      'ewscloud.com',
      'fncstatic.com',
      'fontawesome.com',
      'hgmsites.net',
      'hsforms.net',
      'hubspot.com',
      'jsdelivr.net',
      'jwplayer.com',
      'jwpsrv.com',
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
    ]);

    const actionMap = badger.storage.getBadgerStorageObject("action_map"),
      actions = actionMap.getItemClones(),
      snitchMap = badger.storage.getBadgerStorageObject("snitch_map");

    for (let domain in actions) {
      const base = window.getBaseDomain(domain);

      if (!MISTAKES.has(base)) {
        continue;
      }

      // remove only if
      // user did not set an override
      // and domain was seen tracking
      const map = actions[domain];
      if (map.userAction != "" || (
        map.heuristicAction != constants.ALLOW &&
        map.heuristicAction != constants.BLOCK &&
        map.heuristicAction != constants.COOKIEBLOCK
      )) {
        continue;
      }

      console.log("Removing %s ...", domain);
      actionMap.deleteItem(domain);
      snitchMap.deleteItem(base);
    }
  },

  unblockIncorrectlyBlockedDomains: function (badger) {
    console.log("Running migration to unblock likely incorrectly blocked domains ...");

    let action_map = badger.storage.getBadgerStorageObject("action_map"),
      snitch_map = badger.storage.getBadgerStorageObject("snitch_map");

    // for every blocked domain
    for (let domain in action_map.getItemClones()) {
      if (action_map.getItem(domain).heuristicAction != constants.BLOCK) {
        continue;
      }

      let base_domain = window.getBaseDomain(domain);

      // let's check snitch map
      // to see what state the blocked domain should be in instead
      let sites = snitch_map.getItem(base_domain);

      // default to "no tracking"
      // using "" and not constants.NO_TRACKING to match current behavior
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
  },

  forgetBlockedDNTDomains: function(badger) {
    console.log('Running migration to forget mistakenly blocked DNT domains');

    let action_map = badger.storage.getBadgerStorageObject("action_map"),
      snitch_map = badger.storage.getBadgerStorageObject("snitch_map"),
      domainsToFix = new Set(['eff.org', 'medium.com']);

    for (let domain in action_map.getItemClones()) {
      let base = window.getBaseDomain(domain);
      if (domainsToFix.has(base)) {
        action_map.deleteItem(domain);
        snitch_map.deleteItem(base);
      }
    }
  },

  reapplyYellowlist: function (badger) {
    console.log("(Re)applying yellowlist ...");

    let blocked = badger.storage.getAllDomainsByPresumedAction(
      constants.BLOCK);

    // reblock all blocked domains to trigger yellowlist logic
    for (let i = 0; i < blocked.length; i++) {
      let domain = blocked[i];
      badger.heuristicBlocking.blacklistOrigin(
        window.getBaseDomain(domain), domain);
    }
  },

  forgetNontrackingDomains: function (badger) {
    console.log("Forgetting non-tracking domains ...");

    const actionMap = badger.storage.getBadgerStorageObject("action_map"),
      actions = actionMap.getItemClones();

    for (let domain in actions) {
      const map = actions[domain];
      if (map.userAction == "" && map.heuristicAction == "") {
        actionMap.deleteItem(domain);
      }
    }
  },

  resetWebRTCIPHandlingPolicy: function (badger) {
    console.log("Resetting webRTCIPHandlingPolicy ...");

    if (!badger.webRTCAvailable) {
      return;
    }

    const cpn = chrome.privacy.network;

    cpn.webRTCIPHandlingPolicy.get({}, function (result) {
      if (!result.levelOfControl.endsWith('_by_this_extension')) {
        return;
      }

      if (result.value == 'default_public_interface_only') {
        cpn.webRTCIPHandlingPolicy.clear({});
      }
    });
  },

};



return exports;
})(); //require scopes
