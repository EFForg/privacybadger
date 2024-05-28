/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2024 Electronic Frontier Foundation
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

/* globals badger:false */

import sdb from "../../data/surrogates.js";

import dnrUtils from "./utils.js";

import constants from "../../js/constants.js";
import utils from "../../js/utils.js";

/**
 * Updates Declarative Net Request rules(ets)
 * and registered content scripts in response to settings updates.
 */
function subscribeToStorageUpdates() {
  let settingsStore = badger.getSettings();

  // update static rulesets

  settingsStore.subscribe("set:sendDNTSignal", function (enabled) {
    dnrUtils.updateEnabledRulesets({
      [enabled ? 'enableRulesetIds' : 'disableRulesetIds']: ['dnt_signal_ruleset']
    });
  });
  settingsStore.subscribe("set:checkForDNTPolicy", function (enabled) {
    dnrUtils.updateEnabledRulesets({
      [enabled ? 'enableRulesetIds' : 'disableRulesetIds']: ['dnt_policy_ruleset']
    });
  });

  // update dynamic rules

  settingsStore.subscribe("set:checkForDNTPolicy", function (enabled) {
    if (enabled) {
      // create allow rules for DNT domains
      let addRules = [],
        actionMap = badger.storage.getStore('action_map');
      for (let domain of actionMap.keys()) {
        if (actionMap.getItem(domain).dnt) {
          // TODO don't add if already covered by static rules
          addRules.push(dnrUtils.makeDnrAllowRule(
            badger.getDynamicRuleId(), domain, constants.DNR_DNT_ALLOW));
        }
      }
      if (addRules.length) {
        dnrUtils.updateDynamicRules({ addRules });
      }

    } else {
      // remove all dynamic DNT domain allow rules
      chrome.declarativeNetRequest.getDynamicRules(rules => {
        let removeRuleIds = rules.filter(rule => {
          return (rule.action.type == "allow" && rule.priority == constants.DNR_DNT_ALLOW);
        }).map(rule => rule.id);
        if (removeRuleIds.length) {
          dnrUtils.updateDynamicRules({ removeRuleIds });
        }
      });
    }
  });

  settingsStore.subscribe("set:disabledSites",
    utils.debounce(dnrUtils.updateDisabledSitesRules, 100));

  settingsStore.subscribe("set:widgetSiteAllowlist",
    utils.debounce(dnrUtils.updateWidgetSiteAllowlistRules, 100));

  // update content scripts

  settingsStore.subscribe("set:sendDNTSignal", function (enabled) {
    if (enabled) {
      let dntScript = constants.CONTENT_SCRIPTS.find(item => item.id == "dnt_signal");
      dntScript.excludeMatches = dnrUtils.convertSiteDomainsToMatchPatterns(
        this.getItem("disabledSites"));
      chrome.scripting.registerContentScripts([dntScript]);
    } else {
      chrome.scripting.unregisterContentScripts({
        ids: ["dnt_signal"]
      });
    }
  });
  settingsStore.subscribe("set:disabledSites", function (siteDomains) {
    chrome.scripting.updateContentScripts([{
      id: "dnt_signal",
      excludeMatches: dnrUtils.convertSiteDomainsToMatchPatterns(siteDomains)
    }]).catch(function () {
      // ignore "Content script with ID 'foo' does not exist or is not fully registered"
    });
  });
}

/**
 * Updates dynamic DNR rules in response to changes in domain status.
 *
 * Separated from subscribeToStorageUpdates() to avoid creating
 * dynamic rules on seed loading.
 */
function subscribeToActionMapUpdates() {
  let actionMap = badger.storage.getStore('action_map'),
    fpStore = badger.storage.getStore('fp_scripts'),
    queue = {};

  /**
   * @param {String} domain
   * @param {?Object} newVal
   * @param {?Object} oldVal
   * @param {Array} rules
   */
  function _updateDynamicRulesForDomain(domain, newVal, oldVal, rules) {
    let opts = {}, addRules = [];

    // first see if this is a deletion
    if (!newVal) {
      // remove any existing dynamic rules for this domain
      let existingRules = rules.filter(r => r.condition.requestDomains.includes(domain));
      if (existingRules.length) {
        opts.removeRuleIds = existingRules.map(r => r.id);
        dnrUtils.updateDynamicRules(opts);
      }
      return;
    }

    // are we removing or updating a user action?
    if (oldVal && oldVal.userAction && newVal.userAction != oldVal.userAction) {
      let existingRules = rules.filter(
        r => r.condition.requestDomains.includes(domain)
          && constants.DNR_USER_ACTIONS.has(r.priority));
      if (existingRules.length) {
        opts.removeRuleIds = existingRules.map(r => r.id);
        dnrUtils.updateDynamicRules(opts);
      }
      // removing user action, nothing else to do
      if (!newVal.userAction) {
        return;
      }
    }

    // is the domain no longer DNT compliant?
    if (oldVal && oldVal.dnt && !newVal.dnt) {
      let existingRules = rules.filter(r => {
        return (r.condition.requestDomains.includes(domain) &&
          r.priority == constants.DNR_DNT_ALLOW);
      });
      if (existingRules.length) {
        opts.removeRuleIds = existingRules.map(r => r.id);
      }
    }

    // (A) user actions take top priority
    if (newVal.userAction == constants.USER_BLOCK) {
      addRules.push(dnrUtils.makeDnrBlockRule(badger.getDynamicRuleId(), domain, constants.DNR_USER_BLOCK));
      if (utils.hasOwn(sdb.hostnames, domain)) {
        // TODO only if these aren't already in static rules or existingRules
        addRules.push(...dnrUtils.getDnrSurrogateRules(badger.getDynamicRuleId.bind(badger), domain));
      }
    } else if (newVal.userAction == constants.USER_COOKIEBLOCK) {
      addRules.push(dnrUtils.makeDnrCookieblockRule(
        badger.getDynamicRuleId(), domain, constants.DNR_USER_COOKIEBLOCK_HEADERS));
      addRules.push(dnrUtils.makeDnrAllowRule(
        badger.getDynamicRuleId(), domain, constants.DNR_USER_COOKIEBLOCK_ALLOW));
    } else if (newVal.userAction == constants.USER_ALLOW) {
      addRules.push(dnrUtils.makeDnrAllowRule(badger.getDynamicRuleId(), domain, constants.DNR_USER_ALLOW));

    // (B) then DNT
    } else if (badger.getSettings().getItem("checkForDNTPolicy") && newVal.dnt) {
      addRules.push(dnrUtils.makeDnrAllowRule(badger.getDynamicRuleId(), domain, constants.DNR_DNT_ALLOW));

    // (C) and finally heuristic actions
    } else if ([constants.BLOCK, constants.COOKIEBLOCK].includes(newVal.heuristicAction)) {
      if (newVal.heuristicAction == constants.COOKIEBLOCK) {
        addRules.push(dnrUtils.makeDnrCookieblockRule(badger.getDynamicRuleId(), domain));
        addRules.push(dnrUtils.makeDnrAllowRule(
          badger.getDynamicRuleId(), domain, constants.DNR_COOKIEBLOCK_ALLOW));
      } else {
        addRules.push(dnrUtils.makeDnrBlockRule(badger.getDynamicRuleId(), domain));
        if (utils.hasOwn(sdb.hostnames, domain)) {
          // TODO only if these aren't already in static rules
          addRules.push(...dnrUtils.getDnrSurrogateRules(badger.getDynamicRuleId.bind(badger), domain));
        }
      }
    }

    if (addRules.length) {
      opts.addRules = addRules;
    }

    if (opts.addRules || opts.removeRuleIds) {
      dnrUtils.updateDynamicRules(opts);
    }
  }

  let _updateDynamicRules = utils.debounce(function () {
    chrome.declarativeNetRequest.getDynamicRules(rules => {
      for (let domain in queue) {
        for (let values of queue[domain]) {
          _updateDynamicRulesForDomain(domain, values.newVal, values.oldVal, rules);
        }
      }
      queue = {};
    });
  }, 100);

  actionMap.subscribe("set:*", function (actionObj, domain) {
    let oldAction = actionMap.getItem(domain);
    if (oldAction) {
      // skip when no practical change
      if (oldAction.heuristicAction == actionObj.heuristicAction &&
        !!oldAction.dnt == !!actionObj.dnt && // normalize DNT property
        oldAction.userAction == actionObj.userAction) {
        return;
      }
    }

    if (!utils.hasOwn(queue, domain)) {
      queue[domain] = [];
    }
    queue[domain].push({
      newVal: actionObj,
      oldVal: oldAction
    });

    _updateDynamicRules();
  });

  actionMap.subscribe("delete:*", function (_, domain) {
    if (!utils.hasOwn(queue, domain)) {
      queue[domain] = [];
    }
    queue[domain].push({
      newVal: null
    });

    _updateDynamicRules();
  });

  // block known CDN-hosted fingerprinters
  // https://github.com/EFForg/privacybadger/pull/2891
  fpStore.subscribe("set:*", function (fpScripts, domain) {
    let addRules = [];

    if (!constants.FP_CDN_DOMAINS.has(domain)) {
      return;
    }

    if (sdb.hostnames[domain]) {
      if (sdb.hostnames[domain].match == sdb.MATCH_SUFFIX) {
        for (let token of sdb.hostnames[domain].tokens) {
          addRules.push(dnrUtils.makeDnrFpScriptSurrogateRule(
            badger.getDynamicRuleId(),
            domain,
            token,
            '/' + sdb.surrogates[token].slice(chrome.runtime.getURL('').length)));
        }
      }
    }

    for (let path of Object.keys(fpScripts)) {
      addRules.push(dnrUtils.makeDnrFpScriptBlockRule(
        badger.getDynamicRuleId(), domain, path));
    }

    dnrUtils.updateDynamicRules({ addRules });
  });
}

export {
  subscribeToActionMapUpdates,
  subscribeToStorageUpdates,
};
