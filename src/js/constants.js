/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

let exports = {
  // Tracking status constants
  NO_TRACKING: "noaction",
  ALLOW: "allow",
  BLOCK: "block",
  COOKIEBLOCK: "cookieblock",
  DNT: "dnt",
  USER_ALLOW: "user_allow",
  USER_BLOCK: "user_block",
  USER_COOKIEBLOCK: "user_cookieblock",

  // URLs
  CNAME_DOMAINS_LOCAL_URL: chrome.runtime.getURL('data/cname_domains.json'),
  DNT_POLICIES_URL: "https://www.eff.org/files/dnt-policies.json",
  DNT_POLICIES_LOCAL_URL: chrome.runtime.getURL('data/dnt-policies.json'),
  YELLOWLIST_URL: "https://www.eff.org/files/cookieblocklist_new.txt",
  YELLOWLIST_LOCAL_URL: chrome.runtime.getURL('data/yellowlist.txt'),
  SEED_DATA_LOCAL_URL: chrome.runtime.getURL('data/seed.json'),

  // The number of 1st parties a 3rd party can be seen on
  TRACKING_THRESHOLD: 3,
  MAX_COOKIE_ENTROPY: 12,

  DNT_POLICY_CHECK_INTERVAL: 1000, // one second

  PANOPTICLICK_DOMAINS: ["trackersimulator.org", "eviltracker.net"],

  // Declarative Net Request priorities
  DNR_BLOCK: 1,
  DNR_COOKIEBLOCK_ALLOW: 2,
  DNR_COOKIEBLOCK_HEADERS: 3,
  DNR_DNT_CHECK_ALLOW: 3,
  DNR_DNT_CHECK_HEADERS: 4,
  DNR_DNT_HEADER: 4,
  DNR_DNT_ALLOW: 25,
  DNR_USER_BLOCK: 40,
  DNR_SURROGATE_REDIRECT: 50,
  DNR_USER_COOKIEBLOCK_ALLOW: 59,
  DNR_USER_COOKIEBLOCK_HEADERS: 60,
  DNR_USER_ALLOW: 70,
  DNR_WIDGET_ALLOW_ALL: 75,
  DNR_SITE_ALLOW_ALL: 100,

  CONTENT_SCRIPTS: [{
    id: "dnt_signal",
    js: ["js/contentscripts/dnt.js"],
    matches: ["<all_urls>"],
    allFrames: true,
    matchOriginAsFallback: true, // crbug.com/55084
    runAt: "document_start",
    world: chrome.scripting.ExecutionWorld.MAIN,
    persistAcrossSessions: false,
  }]
};

exports.BLOCKED_ACTIONS = new Set([
  exports.BLOCK,
  exports.USER_BLOCK,
  exports.COOKIEBLOCK,
  exports.USER_COOKIEBLOCK,
]);

exports.DNR_USER_ACTIONS = new Set([
  exports.DNR_USER_BLOCK,
  exports.DNR_USER_COOKIEBLOCK_ALLOW,
  exports.DNR_USER_COOKIEBLOCK_HEADERS,
  exports.DNR_USER_ALLOW
]);

export default exports;
