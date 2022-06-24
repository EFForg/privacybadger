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

  // URLS
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
};

exports.BLOCKED_ACTIONS = new Set([
  exports.BLOCK,
  exports.USER_BLOCK,
  exports.COOKIEBLOCK,
  exports.USER_COOKIEBLOCK,
]);

export default exports;
