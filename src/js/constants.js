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

require.scopes.constants = (function() {

var exports = {

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
  DNT_POLICIES_URL: "https://www.eff.org/files/dnt-policies.json",
  DNT_POLICIES_LOCAL_URL: chrome.runtime.getURL('data/dnt-policies.json'),
  YELLOWLIST_URL: "https://www.eff.org/files/cookieblocklist_new.txt",
  YELLOWLIST_LOCAL_URL: chrome.runtime.getURL('data/yellowlist.txt'),
  SEED_DATA_LOCAL_URL: chrome.runtime.getURL('data/seed.json'),

  // The number of 1st parties a 3rd party can be seen on
  TRACKING_THRESHOLD: 3,
  MAX_COOKIE_ENTROPY: 12,

  // The max amount of time (in milliseconds) that PB will wait before sharing a
  // tracking action with EFF for community learning
  MAX_CL_WAIT_TIME: 5 * 60 * 1000, // five minutes

  // The probability that any given tracking action will be logged to the
  // community server, as a float from 0.0 to 1.0
  CL_PROBABILITY: 1.0,

  // size of the in-memory community learning cache
  CL_CACHE_SIZE: 5000,

  DNT_POLICY_CHECK_INTERVAL: 1000, // one second
};

exports.BLOCKED_ACTIONS = new Set([
  exports.BLOCK,
  exports.USER_BLOCK,
  exports.COOKIEBLOCK,
  exports.USER_COOKIEBLOCK,
]);

exports.TRACKER_TYPES = Object.freeze({
  COOKIE: "cookie",
  COOKIE_SHARE: "cookie_share",
  SUPERCOOKIE: "supercookie",
  FINGERPRINT: "fingerprint",
})

return exports;
})();
