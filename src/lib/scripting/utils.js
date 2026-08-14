/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2026 Electronic Frontier Foundation
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

import utils from "../../js/utils.js";

/**
 * https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 *
 * @param {Array<String>} hosts The site domains to convert to match patterns
 *
 * @returns {Array<String>}
 */
function convertHostsToMatchPatterns(hosts) {
  return hosts.map(site => {
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
 * excludeMatches helper for registering and updating
 * the registration of the dnt_signal content script.
 *
 * @param {Object} [hosts]
 *
 * @returns {Array<String>}
 */
function getDntScriptExcludeMatches(hosts = {}) {
  let disabledSites = (utils.hasOwn(hosts, "disabledSites") ?
    hosts.disabledSites :
    badger.getSettings().getItem("disabledSites"));

  let gpcDisabledHosts = (utils.hasOwn(hosts, "gpcDisabledHosts") ?
    hosts.gpcDisabledHosts :
    Object.keys(badger.getPrivateSettings().getItem("gpcDisabledSites")));

  return utils.concatUniq(
    convertHostsToMatchPatterns(disabledSites),
    convertHostsToMatchPatterns(gpcDisabledHosts));
}

export {
  convertHostsToMatchPatterns,
  getDntScriptExcludeMatches
};
