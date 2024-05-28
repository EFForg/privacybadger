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

import { log } from "../../js/bootstrap.js";
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
          addRules.push(dnrUtils.makeDnrAllowRule(
            domain, constants.DNR_DNT_ALLOW));
        }
      }
      if (addRules.length) {
        dnrUtils.updateDynamicRules({ addRules });
      }

    } else {
      // remove all dynamic DNT domain allow rules
      chrome.declarativeNetRequest.getDynamicRules(rules => {
        let removeRuleIds = rules.filter(rule =>
          rule.action.type == "allow" &&
          rule.priority == constants.DNR_DNT_ALLOW).map(rule => rule.id);
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
 * @param {String} domain
 * @param {?Object} newVal
 * @param {?Object} oldVal
 * @param {Array} rules existing dynamic rules
 *
 * @returns {Object}
 */
function _getDynamicRulesForDomain(domain, newVal, oldVal, rules) {
  let opts = {}, addRules = [];

  // first mark all existing rules for removal
  let existingRules = rules.filter(r =>
    r.priority != constants.DNR_WIDGET_ALLOW_ALL &&
      r.priority != constants.DNR_SITE_ALLOW_ALL &&
      r.condition.requestDomains &&
      r.condition.requestDomains.includes(domain));
  if (existingRules.length) {
    opts.removeRuleIds = existingRules.map(r => r.id);
  }

  // if this is a deletion, nothing else to do
  if (!newVal) {
    return opts;
  }

  // user actions and DNT stack on top of heuristic actions
  if (newVal.userAction == constants.USER_BLOCK) {
    addRules.push(dnrUtils.makeDnrBlockRule(
      domain, constants.DNR_USER_BLOCK));

  } else if (newVal.userAction == constants.USER_COOKIEBLOCK) {
    addRules.push(dnrUtils.makeDnrCookieblockRule(
      domain, constants.DNR_USER_COOKIEBLOCK_HEADERS));
    addRules.push(dnrUtils.makeDnrAllowRule(
      domain, constants.DNR_USER_COOKIEBLOCK_ALLOW));
    // TODO also add rule to make referrer header origin-only
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1149619

  } else if (newVal.userAction == constants.USER_ALLOW) {
    addRules.push(dnrUtils.makeDnrAllowRule(
      domain, constants.DNR_USER_ALLOW));

  } else if (badger.getSettings().getItem("checkForDNTPolicy") && newVal.dnt) {
    addRules.push(dnrUtils.makeDnrAllowRule(domain, constants.DNR_DNT_ALLOW));
  }

  // now set the appropriate heuristic action
  if (newVal.heuristicAction == constants.COOKIEBLOCK) {
    addRules.push(dnrUtils.makeDnrCookieblockRule(domain));
    addRules.push(dnrUtils.makeDnrAllowRule(
      domain, constants.DNR_COOKIEBLOCK_ALLOW));
    // TODO also add rule to make referrer header origin-only
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1149619

  } else if (newVal.heuristicAction == constants.BLOCK) {
    addRules.push(dnrUtils.makeDnrBlockRule(domain));
  }

  if (addRules.length) {
    opts.addRules = addRules;
  }

  return opts;
}

/**
 * Updates dynamic DNR rules in response to changes in domain status.
 */
function subscribeToActionMapUpdates() {
  let actionMap = badger.storage.getStore('action_map'),
    fpStore = badger.storage.getStore('fp_scripts'),
    actionMapUpdateQueue = {},
    fpStoreUpdateQueue = {};

  let _updateDynamicRules = utils.debounce(async function () {
    let opts = {
      addRules: [],
      removeRuleIds: []
    };

    let existingRules = await chrome.declarativeNetRequest.getDynamicRules();

    log("[DNR] Size of action_map rules queue:", Object.keys(actionMapUpdateQueue).length);

    for (let domain in actionMapUpdateQueue) {
      for (let values of actionMapUpdateQueue[domain]) {
        let { addRules, removeRuleIds } = _getDynamicRulesForDomain(
          domain, values.newVal, values.oldVal, existingRules);

        if (values.newVal) {
          if (values.newVal.userAction == constants.USER_COOKIEBLOCK ||
            values.newVal.heuristicAction == constants.COOKIEBLOCK) {
            for (let host of fpStore.keys()) {
              if (constants.FP_CDN_DOMAINS.has(host)) {
                if (host == domain || host.endsWith('.' + domain)) {
                  if (!utils.hasOwn(fpStoreUpdateQueue, host)) {
                    fpStoreUpdateQueue[host] = new Set();
                  }
                  for (let path of Object.keys(fpStore.getItem(host))) {
                    fpStoreUpdateQueue[host].add(path);
                  }
                }
              }
            }
          }
        }

        if (addRules && addRules.length) {
          // don't add cookieblock rules when followed by block rules (domain
          // is cookieblocked in seed data but is no longer on the yellowlist)
          for (let newRule of addRules) {
            if (newRule.priority == constants.DNR_BLOCK) {
              opts.addRules = opts.addRules.filter(rule =>
                !(rule.condition.requestDomains.includes(domain) &&
                (rule.priority == constants.DNR_COOKIEBLOCK_HEADERS ||
                  rule.priority == constants.DNR_COOKIEBLOCK_ALLOW)));
            }
          }

          opts.addRules = opts.addRules.concat(addRules);
        }

        if (removeRuleIds && removeRuleIds.length) {
          opts.removeRuleIds = opts.removeRuleIds.concat(removeRuleIds);
        }
      }
    }

    // now redo surrogate rules
    let addRules = [],
      removeRuleIds = existingRules
        .filter(r => r.priority == constants.DNR_SURROGATE_REDIRECT)
        .map(r => r.id);
    for (let host of Object.keys(sdb.hostnames)) {
      let action = badger.storage.getBestAction(host);
      if (action == constants.BLOCK || action == constants.USER_BLOCK) {
        addRules.push(...dnrUtils.getDnrSurrogateRules(host));
      }
    }
    if (addRules.length) {
      opts.addRules = opts.addRules.concat(addRules);
    }
    if (removeRuleIds.length) {
      opts.removeRuleIds = opts.removeRuleIds.concat(removeRuleIds);
    }

    log("[DNR] Size of fp_scripts rules queue:", Object.keys(fpStoreUpdateQueue).length);

    for (let domain in fpStoreUpdateQueue) {
      // block rules
      for (let path of fpStoreUpdateQueue[domain]) {
        opts.addRules.push(dnrUtils.makeDnrFpScriptBlockRule(
          badger.getDynamicRuleId(), domain, path));
      }

      // surrogate rules
      if (!sdb.hostnames[domain]) {
        continue;
      }
      if (sdb.hostnames[domain].match != sdb.MATCH_SUFFIX) {
        console.error(`Failed to create script surrogate rule for ${domain}:
  Time to add support for ${sdb.hostnames[domain].match} matching`);
        continue;
      }
      for (let token of sdb.hostnames[domain].tokens) {
        opts.addRules.push(dnrUtils.makeDnrFpScriptSurrogateRule(
          badger.getDynamicRuleId(),
          domain,
          token,
          '/' + sdb.surrogates[token].slice(chrome.runtime.getURL('').length)));
      }
    }

    if (opts.addRules.length || opts.removeRuleIds.length) {
      dnrUtils.updateDynamicRules(opts);
    }

    actionMapUpdateQueue = {};
    fpStoreUpdateQueue = {};

  }, 100);

  actionMap.subscribe("set:*", function (actionObj, domain) {
    let oldAction = actionMap.getItem(domain);
    if (oldAction) {
      if (oldAction.heuristicAction == actionObj.heuristicAction &&
        oldAction.userAction == actionObj.userAction) {
        if (!!oldAction.dnt == !!actionObj.dnt) {
          // skip when no practical change
          return;
        } else if (!oldAction.dnt && actionObj.dnt) {
          if (!badger.getSettings().getItem("checkForDNTPolicy")) {
            // skip DNT updates when EFF's DNT policy checking is disabled
            return;
          }
        }
      }
    } else {
      // no DNR updates when we're simply setting nextUpdateTime
      if ((actionObj.heuristicAction == constants.ALLOW ||
          actionObj.heuristicAction == '') &&
        actionObj.userAction == '' && !actionObj.dnt) {
        return;
      }
    }

    if (!utils.hasOwn(actionMapUpdateQueue, domain)) {
      actionMapUpdateQueue[domain] = [];
    }
    actionMapUpdateQueue[domain].push({
      newVal: actionObj,
      oldVal: oldAction
    });

    _updateDynamicRules();
  });

  actionMap.subscribe("delete:*", function (_, domain) {
    if (!utils.hasOwn(actionMapUpdateQueue, domain)) {
      actionMapUpdateQueue[domain] = [];
    }
    actionMapUpdateQueue[domain].push({
      newVal: null
    });

    _updateDynamicRules();
  });

  // update dynamic DNR rules in response to changes in fp_scripts
  // so that we block known CDN-hosted fingerprinters
  // https://github.com/EFForg/privacybadger/pull/2891
  badger.storage.getStore('fp_scripts').subscribe("set:*", function (fpScripts, domain) {
    if (!constants.FP_CDN_DOMAINS.has(domain)) {
      return;
    }

    let action = badger.storage.getBestAction(domain);
    if (action != constants.COOKIEBLOCK && action != constants.USER_COOKIEBLOCK) {
      return;
    }

    if (!utils.hasOwn(fpStoreUpdateQueue, domain)) {
      fpStoreUpdateQueue[domain] = new Set();
    }
    for (let path of Object.keys(fpScripts)) {
      fpStoreUpdateQueue[domain].add(path);
    }

    _updateDynamicRules();
  });
}

export {
  subscribeToActionMapUpdates,
  subscribeToStorageUpdates,
};
