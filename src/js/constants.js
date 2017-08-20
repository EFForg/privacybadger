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
  USER_COOKIE_BLOCK: "user_cookieblock",

  // URLS
  DNT_POLICIES_URL: "https://www.eff.org/files/dnt-policies.json",
  YELLOWLIST_URL: "https://www.eff.org/files/cookieblocklist_new.txt",

  // The number of 1st parties a 3rd party can be seen on
  TRACKING_THRESHOLD: 3,
  MAX_COOKIE_ENTROPY: 12,

  DNT_POLICY_CHECK_INTERVAL: 1000, // one second
};

exports.BLOCKED_ACTIONS = new Set([
  exports.BLOCK,
  exports.USER_BLOCK,
  exports.COOKIEBLOCK,
  exports.USER_COOKIE_BLOCK,
]);

return exports;
})();
