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

import { getBaseDomain } from "../../lib/basedomain.js";
import { log } from "../../js/bootstrap.js";

import constants from "../../js/constants.js";
import mdfp from "../../js/multiDomainFirstParties.js";
import utils from "../../js/utils.js";

/**
 * https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 *
 * See also updateDisabledSitesRules()
 *
 * @param {Array} disabledSites
 */
function convertSiteDomainsToMatchPatterns(disabledSites) {
  return disabledSites.map(site => {
    if (site.startsWith("*")) {
      site = site.slice(1);
      if (site.startsWith(".")) {
        site = site.slice(1);
      }
    }
    return `*://*.${site}/*`;
  });
}

/**
 * Constructs a DNR rule object that blocks a domain and its subdomains.
 *
 * @param {String} domain
 * @param {Integer} [priority]
 *
 * @returns {Object}
 */
function makeDnrBlockRule(domain, priority) {
  let id = badger.getDynamicRuleId();

  let action = {
    type: 'block'
  };

  let condition = {
    requestDomains: [domain],
    // TODO "A request is said to be first party if it has the same domain (eTLD+1) as the frame in which the request originated."
    // TODO will this ever be a problem? frame vs. top-level frame
    domainType: 'thirdParty',
  };
  let mdfpList = mdfp.getEntityList(getBaseDomain(domain));
  if (mdfpList.length) {
    condition.excludedInitiatorDomains = mdfpList;
  }

  priority = priority || constants.DNR_BLOCK;

  let rule = { id, action, condition, priority };

  return rule;
}

/**
 * Constructs a DNR rule object that cookieblocks a domain and its subdomains.
 *
 * @param {String} domain
 * @param {Integer} [priority]
 *
 * @returns {Object}
 */
function makeDnrCookieblockRule(domain, priority) {
  let id = badger.getDynamicRuleId();

  let action = {
    type: 'modifyHeaders',
    requestHeaders: [{ header: "cookie", operation: "remove" }],
    responseHeaders: [{ header: "set-cookie", operation: "remove" }]
  };

  let condition = {
    requestDomains: [domain],
    domainType: 'thirdParty',
  };
  let mdfpList = mdfp.getEntityList(getBaseDomain(domain));
  if (mdfpList.length) {
    condition.excludedInitiatorDomains = mdfpList;
  }

  if (!priority) {
    priority = constants.DNR_COOKIEBLOCK_HEADERS;
  }

  let rule = { id, action, condition, priority };

  return rule;
}

/**
 * As part of cookieblocking, constructs a DNR rule object
 * that allows a domain and its subdomains.
 *
 * This is so that we can stack/layer (cookieblock over block) rules.
 *
 * @param {String} domain
 * @param {Integer} [priority]
 *
 * @returns {Object}
 */
function makeDnrAllowRule(domain, priority) {
  let id = badger.getDynamicRuleId();

  priority = priority || constants.DNR_COOKIEBLOCK_ALLOW;

  let action = {
    type: 'allow'
  };

  let condition = {
    requestDomains: [domain],
    domainType: 'thirdParty'
  };

  let rule = { id, action, condition, priority };

  return rule;
}

/**
 * Constructs a DNR rule object for replacing scripts with our surrogates.
 *
 * @param {Integer} id
 * @param {String} script_host
 * @param {String} surrogate_path
 * @param {Object} extraConditions
 * @param {Integer?} priority
 *
 * @returns {Object}
 */
function makeDnrSurrogateRule(id, script_host, surrogate_path, extraConditions, priority) {
  let rule = {
    id,
    priority: priority || constants.DNR_SURROGATE_REDIRECT,
    action: {
      type: 'redirect',
      redirect: {
        extensionPath: surrogate_path
      }
    },
    condition: {
      requestDomains: [script_host],
      resourceTypes: ['script'],
      domainType: 'thirdParty',
      excludedInitiatorDomains: mdfp.getEntityList(getBaseDomain(script_host))
    }
  };

  if (extraConditions) {
    for (let key in extraConditions) {
      rule.condition[key] = extraConditions[key];
    }
  }

  if (!rule.condition.excludedInitiatorDomains.length) {
    delete rule.condition.excludedInitiatorDomains;
  }

  return rule;
}

/**
 * A single hostname may have multiple associated surrogates.
 * This function generates all associated DNR rule objects.
 *
 * @param {String} domain
 *
 * @returns {Array} DNR rule objects for this domain
 */
function getDnrSurrogateRules(domain) {
  let rules = [],
    conf = sdb.hostnames[domain];

  if (conf.match == sdb.MATCH_ANY) {
    rules.push(makeDnrSurrogateRule(badger.getDynamicRuleId(),
      domain, sdb.surrogates[conf.token]));

  } else if (conf.match == sdb.MATCH_SUFFIX) {
    for (let token of conf.tokens) {
      let extra = {
        // URL ends with:
        // - token
        // - token followed by ? followed by any number of characters
        // - token followed by # followed by any number of characters
        // (?:) is an RE2 non-capturing group
        regexFilter: utils.regexEscape(token) + '(?:\\?.*|#.*|$)'
      };
      rules.push(makeDnrSurrogateRule(badger.getDynamicRuleId(),
        domain, sdb.surrogates[token], extra));
    }

  } else if (conf.match == sdb.MATCH_PREFIX) {
    for (let token of conf.tokens) {
      let extra = {
        urlFilter: '||' + domain + token + '^'
      };
      rules.push(makeDnrSurrogateRule(badger.getDynamicRuleId(),
        domain, sdb.surrogates[token], extra));
    }

  } else if (conf.match == sdb.MATCH_PREFIX_WITH_PARAMS) {
    for (let token of conf.tokens) {
      // TODO fix matching on conf.params
      let extra = {
        urlFilter: '||' + domain + token + '?*' + Object.keys(conf.params).join('^*^')
      };
      rules.push(makeDnrSurrogateRule(badger.getDynamicRuleId(),
        domain, sdb.surrogates[token], extra));
    }
  }

  return rules;
}

/**
 * Constructs a DNR rule object for blocking CDN-hosted fingerprinter scripts.
 *
 * @param {Integer} id
 * @param {String} domain
 * @param {String} path
 *
 * @returns {Object}
 */
function makeDnrFpScriptBlockRule(id, domain, path) {
  return {
    id,
    priority: constants.DNR_FP_SCRIPT_BLOCK,
    action: { type: 'block' },
    condition: {
      requestDomains: [domain],
      resourceTypes: ['script'],
      urlFilter: '||' + domain + path + '^',
      domainType: 'thirdParty',
      excludedInitiatorDomains: mdfp.getEntityList(getBaseDomain(domain))
    }
  };
}

/**
 * Constructs a DNR rule object for replacing CDN-hosted
 * fingerprinter scripts with our surrogate scripts.
 *
 * @param {Integer} id
 * @param {String} domain
 * @param {String} match_token
 * @param {String} surrogate_path
 *
 * @returns {Object}
 */
function makeDnrFpScriptSurrogateRule(id, domain, match_token, surrogate_path) {
  let extraConditions = {
    // TODO this is hardcoded to sdb.MATCH_SUFFIX only
    regexFilter: utils.regexEscape(match_token) + '(?:\\?.*|#.*|$)',
  };
  return makeDnrSurrogateRule(id, domain, surrogate_path, extraConditions,
    constants.DNR_FP_SCRIPT_SURROGATE_REDIRECT);
}

/**
 * We use DNR session rules to allow user-activated widgets to load.
 */
let updateSessionAllowRules = utils.debounce(async function (tempAllowlist) {
  let id = 0,
    opts = {
      addRules: [],
      removeRuleIds: []
    };

  let rules = await chrome.declarativeNetRequest.getSessionRules();

  if (rules.length) {
    // remove all existing session widget rules
    opts.removeRuleIds = rules.filter(r =>
      r.priority == constants.DNR_WIDGET_ALLOW_ALL).map(r => r.id);

    // get the largest session rule ID
    id = Math.max(...rules.filter(r =>
      r.priority != constants.DNR_WIDGET_ALLOW_ALL).map(r => r.id));
  }

  for (let tab_id in tempAllowlist) {
    for (let domain of tempAllowlist[tab_id]) {
      // allow all requests inside frames served by this domain
      id++;
      let rule = {
        id,
        priority: constants.DNR_WIDGET_ALLOW_ALL,
        action: { type: 'allowAllRequests' },
        condition: {
          tabIds: [+tab_id],
          requestDomains: [domain],
          resourceTypes: ['sub_frame']
        }
      };
      if (domain.startsWith("*.")) {
        // support wildcard unblockDomains
        delete rule.condition.requestDomains;
        rule.condition.urlFilter = "||" + domain.slice(2);
      }
      opts.addRules.push(rule);

      // allow requests to this domain
      id++;
      rule = {
        id,
        priority: constants.DNR_WIDGET_ALLOW_ALL,
        action: { type: 'allow' },
        condition: {
          tabIds: [+tab_id],
          requestDomains: [domain]
        }
      };
      if (domain.startsWith("*.")) {
        // support wildcard unblockDomains
        delete rule.condition.requestDomains;
        rule.condition.urlFilter = "||" + domain.slice(2);
      }
      opts.addRules.push(rule);
    }
  }

  if (opts.addRules.length || opts.removeRuleIds.length) {
    chrome.declarativeNetRequest.updateSessionRules(opts);
  }
}, 100);

/**
 * Debounced version of chrome.declarativeNetRequest.updateDynamicRules()
 */
let updateDynamicRules = (function () {
  let queue = [];

  let _update = utils.debounce(function () {
    let opts = {
      addRules: [],
      removeRuleIds: []
    };

    for (let item of queue) {
      if (utils.hasOwn(item, "addRules")) {
        opts.addRules = opts.addRules.concat(item.addRules);
      }
      if (utils.hasOwn(item, "removeRuleIds")) {
        opts.removeRuleIds = opts.removeRuleIds.concat(item.removeRuleIds);
      }
    }
    queue = [];

    log("[DNR] updateDynamicRules: addRules=%s, removeRuleIds=%s",
      opts.addRules.length, opts.removeRuleIds.length);

    chrome.declarativeNetRequest.updateDynamicRules(opts);
  }, 100);

  let ret = function (opts) {
    queue.push(opts);
    _update();
  };

  ret.clearQueue = function () {
    queue = [];
  };

  return ret;
}());

/**
 * Debounced version of chrome.declarativeNetRequest.updateEnabledRulesets()
 */
let updateEnabledRulesets = (function () {
  let queue = [];

  let _update = utils.debounce(function () {
    let opts = {
      enableRulesetIds: [],
      disableRulesetIds: []
    };

    for (let item of queue) {
      if (utils.hasOwn(item, "enableRulesetIds")) {
        opts.enableRulesetIds = opts.enableRulesetIds.concat(item.enableRulesetIds);
      }
      if (utils.hasOwn(item, "disableRulesetIds")) {
        opts.disableRulesetIds = opts.disableRulesetIds.concat(item.disableRulesetIds);
      }
    }
    queue = [];

    log("[DNR] updateEnabledRulesets:", opts);

    chrome.declarativeNetRequest.updateEnabledRulesets(opts);
  }, 100);

  return function (opts) {
    queue.push(opts);
    _update();
  };
}());

/**
 * Updates registered "allow all" DNR rules for the given
 * list of Privacy Badger disabled site entries.
 *
 * See also convertSiteDomainsToMatchPatterns()
 *
 * @param {Array} disabledSites disabled site entries (may contain wildcards)
 */
async function updateDisabledSitesRules(disabledSites) {
  let opts = {
    addRules: []
  };

  let rules = (await chrome.declarativeNetRequest.getDynamicRules())
    .filter(r => r.action.type == "allowAllRequests" &&
      r.priority == constants.DNR_SITE_ALLOW_ALL);

  opts.removeRuleIds = rules.map(r => r.id) || [];

  // remove leading wildcards
  // domains now always match subdomains
  disabledSites = disabledSites.map(site => {
    if (site.startsWith('*')) {
      site = site.slice(1);
      if (site.startsWith('.')) {
        site = site.slice(1);
      }
    }
    return site;
  });

  if (disabledSites.length) {
    opts.addRules.push({
      id: badger.getDynamicRuleId(),
      priority: constants.DNR_SITE_ALLOW_ALL,
      action: { type: 'allowAllRequests' },
      condition: {
        requestDomains: disabledSites,
        resourceTypes: ['main_frame']
      }
    });
  }

  if (opts.addRules.length || opts.removeRuleIds.length) {
    updateDynamicRules(opts);
  }
}

/**
 * Re-registers widget site allowlist[1] DNR rules.
 *
 * [1] Options > Widget Replacement > Site Exceptions
 *
 * @param {Object} widgetSiteAllowlist
 */
async function updateWidgetSiteAllowlistRules(widgetSiteAllowlist) {
  let opts = {
    addRules: []
  };

  let existingRules = await chrome.declarativeNetRequest.getDynamicRules();

  // remove all existing widget site allow rules
  opts.removeRuleIds = existingRules.filter(r => {
    return (r.priority == constants.DNR_WIDGET_ALLOW_ALL);
  }).map(r => r.id);

  for (let site_host in widgetSiteAllowlist) {
    let widgetDomains = widgetSiteAllowlist[site_host].map(widget_name => {
      let widget = badger.widgetList.find(w => w.name == widget_name);
      if (widget && widget.replacementButton && widget.replacementButton.unblockDomains) {
        return widget.replacementButton.unblockDomains;
      }
      return [];
    }).flat();

    for (let domain of widgetDomains) {
      // allow all requests inside frames served by this domain
      let rule = {
        id: badger.getDynamicRuleId(),
        priority: constants.DNR_WIDGET_ALLOW_ALL,
        action: { type: 'allowAllRequests' },
        condition: {
          initiatorDomains: [site_host],
          requestDomains: [domain],
          resourceTypes: ['sub_frame']
        }
      };
      if (domain.startsWith("*.")) {
        // support wildcard unblockDomains
        delete rule.condition.requestDomains;
        rule.condition.urlFilter = "||" + domain.slice(2);
      }
      opts.addRules.push(rule);

      // allow requests to this domain
      rule = {
        id: badger.getDynamicRuleId(),
        priority: constants.DNR_WIDGET_ALLOW_ALL,
        action: { type: 'allow' },
        condition: {
          initiatorDomains: [site_host],
          requestDomains: [domain]
        }
      };
      if (domain.startsWith("*.")) {
        // support wildcard unblockDomains
        delete rule.condition.requestDomains;
        rule.condition.urlFilter = "||" + domain.slice(2);
      }
      opts.addRules.push(rule);
    }
  }

  if (opts.addRules.length || opts.removeRuleIds.length) {
    updateDynamicRules(opts);
  }
}

/**
 * Workaround for https://github.com/w3c/webextensions/issues/302
 * See https://issues.chromium.org/issues/338071843#comment13
 */
function registerGoogleRedirectBypassRules() {
  let addRules = [],
    page = "data/web_accessible_resources/redirect.html",
    interstitial_template = chrome.runtime.getURL(page) + "?url=\\1";

  // a few patterns cover all Google hostnames
  let googlePatterns = [
    "www\\.google\\.com",
    "www\\.google\\.cat",
    "www\\.google\\.com\\...",
    "www\\.google\\...",
    "www\\.google\\.co\\...",
  ];

  for (let pattern of googlePatterns) {
    for (let param of ['.+&q', 'q', '.+&url', 'url']) {
      addRules.push({
        id: addRules.length + 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            regexSubstitution: interstitial_template
          }
        },
        condition: {
          regexFilter: `^https://${pattern}/url\\?${param}=(https?://[^&]+).*`,
          resourceTypes: [
            "main_frame"
          ]
        }
      });
    }
  }

  chrome.declarativeNetRequest.updateSessionRules({ addRules }).then(function () {
    log("[DNR] Registered Google redirect bypass session rules");
  });
}

export default {
  convertSiteDomainsToMatchPatterns,
  getDnrSurrogateRules,
  makeDnrAllowRule,
  makeDnrBlockRule,
  makeDnrCookieblockRule,
  makeDnrFpScriptBlockRule,
  makeDnrFpScriptSurrogateRule,
  registerGoogleRedirectBypassRules,
  updateDisabledSitesRules,
  updateDynamicRules,
  updateEnabledRulesets,
  updateSessionAllowRules,
  updateWidgetSiteAllowlistRules,
};
