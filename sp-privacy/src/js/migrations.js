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

require.scopes.migrations = (function () {

let utils = require("utils");
let constants = require("constants");

let noop = function () {};

let exports = {};

exports.Migrations= {
  changePrivacySettings: noop,
  migrateAbpToStorage: noop,

  migrateBlockedSubdomainsToCookieblock: function(badger) {
    setTimeout(function() {
      console.log('MIGRATING BLOCKED SUBDOMAINS THAT ARE ON COOKIE BLOCK LIST');
      let ylist = badger.storage.getStore('cookieblock_list');
      badger.storage.getAllDomainsByPresumedAction(constants.BLOCK).forEach(fqdn => {
        utils.explodeSubdomains(fqdn, true).forEach(domain => {
          if (ylist.hasItem(domain)) {
            console.log('moving', fqdn, 'from block to cookie block');
            badger.storage.setupHeuristicAction(fqdn, constants.COOKIEBLOCK);
          }
        });
      });
    }, 1000 * 30);
  },

  migrateLegacyFirefoxData: noop,

  migrateDntRecheckTimes: function(badger) {
    var action_map = badger.storage.getStore('action_map');
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
    var action_map = badger.storage.getStore('action_map');
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

    const actionMap = badger.storage.getStore("action_map"),
      actions = actionMap.getItemClones(),
      snitchMap = badger.storage.getStore("snitch_map");

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

    let action_map = badger.storage.getStore("action_map"),
      snitch_map = badger.storage.getStore("snitch_map");

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
          badger.heuristicBlocking.blocklistOrigin(base_domain, domain);
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

    let action_map = badger.storage.getStore("action_map"),
      snitch_map = badger.storage.getStore("snitch_map"),
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
      badger.heuristicBlocking.blocklistOrigin(
        window.getBaseDomain(domain), domain);
    }
  },

  forgetNontrackingDomains: function (badger) {
    console.log("Forgetting non-tracking domains ...");

    const actionMap = badger.storage.getStore("action_map"),
      actions = actionMap.getItemClones();

    for (let domain in actions) {
      const map = actions[domain];
      if (map.userAction == "" && map.heuristicAction == "") {
        actionMap.deleteItem(domain);
      }
    }
  },

  resetWebRTCIPHandlingPolicy: noop,

  enableShowNonTrackingDomains: function (badger) {
    console.log("Enabling showNonTrackingDomains for some users");

    let actionMap = badger.storage.getStore("action_map"),
      actions = actionMap.getItemClones();

    // if we have any customized sliders
    if (Object.keys(actions).some(domain => actions[domain].userAction != "")) {
      // keep showing non-tracking domains in the popup
      badger.getSettings().setItem("showNonTrackingDomains", true);
    }
  },

  forgetFirstPartySnitches: function (badger) {
    console.log("Removing first parties from snitch map...");
    let snitchMap = badger.storage.getStore("snitch_map"),
      actionMap = badger.storage.getStore("action_map"),
      snitchClones = snitchMap.getItemClones(),
      actionClones = actionMap.getItemClones(),
      correctedSites = {};

    for (let domain in snitchClones) {
      // creates new array of domains checking against the isThirdParty utility
      let newSnitches = snitchClones[domain].filter(
        item => utils.isThirdPartyDomain(item, domain));

      if (newSnitches.length) {
        correctedSites[domain] = newSnitches;
      }
    }

    // clear existing maps and then use mergeUserData to rebuild them
    actionMap.updateObject({});
    snitchMap.updateObject({});

    const data = {
      snitch_map: correctedSites,
      action_map: actionClones
    };

    // pass in boolean 2nd parameter to flag that it's run in a migration, preventing infinite loop
    badger.mergeUserData(data, true);
  },

  forgetCloudflare: function (badger) {
    let config = {
      name: '__cfduid'
    };
    if (badger.firstPartyDomainPotentiallyRequired) {
      config.firstPartyDomain = null;
    }

    chrome.cookies.getAll(config, function (cookies) {
      console.log("Forgetting Cloudflare domains ...");

      let actionMap = badger.storage.getStore("action_map"),
        actionClones = actionMap.getItemClones(),
        snitchMap = badger.storage.getStore("snitch_map"),
        snitchClones = snitchMap.getItemClones(),
        correctedSites = {},
        // assume the tracking domains seen on these sites are all Cloudflare
        cfduidFirstParties = new Set();

      cookies.forEach(function (cookie) {
        // get the base domain (also removes the leading dot)
        cfduidFirstParties.add(window.getBaseDomain(cookie.domain));
      });

      for (let domain in snitchClones) {
        let newSnitches = snitchClones[domain].filter(
          item => !cfduidFirstParties.has(item));

        if (newSnitches.length) {
          correctedSites[domain] = newSnitches;
        }
      }

      // clear existing maps and then use mergeUserData to rebuild them
      actionMap.updateObject({});
      snitchMap.updateObject({});

      const data = {
        snitch_map: correctedSites,
        action_map: actionClones
      };

      // pass in boolean 2nd parameter to flag that it's run in a migration, preventing infinite loop
      badger.mergeUserData(data, true);
    });
  },

  // https://github.com/EFForg/privacybadger/pull/2245#issuecomment-545545717
  forgetConsensu: (badger) => {
    console.log("Forgetting consensu.org domains (GDPR consent provider) ...");
    badger.storage.forget("consensu.org");
  },

  resetWebRTCIPHandlingPolicy2: noop,

  resetWebRtcIpHandlingPolicy3: function (badger) {
    if (!badger.webRTCAvailable) {
      return;
    }

    console.log("Migrating WebRTC IP protection ...");
    chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function (res) {
      if (res.levelOfControl != 'controlled_by_this_extension') {
        return;
      }

      // since we previously enabled this privacy override,
      // update corresponding Badger setting
      badger.getSettings().setItem("preventWebRTCIPLeak", true);

      // update the browser setting
      // in case it needs to be migrated from Mode 4 to Mode 3
      badger.setPrivacyOverrides();
    });
  },

  forgetOpenDNS: (badger) => {
    console.log("Forgetting Cisco OpenDNS domains ...");
    badger.storage.forget("opendns.com");
  },

};



return exports;
})(); //require scopes
