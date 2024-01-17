/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2018 Electronic Frontier Foundation
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

import { getBaseDomain } from "./basedomain.js";

/**
 * Filters the list of tracking domains for display on the options page.
 *
 * @param {Object} domains The starting set of domains to be filtered.
 *
 * @param {Object} [options] Could contain the following keys:
 *   {String} [searchFilter] The text to filter domain names against.
 *   {String} [typeFilter] Type: user-controlled/DNT-compliant
 *   {String} [statusFilter] Status: blocked/cookieblocked/allowed
 *   {Boolean} [showNotYetBlocked] Whether to show domains your Badger
 *     hasn't yet learned to block.
 *   {Boolean} [hideInSeed] Whether to hide domains found in seed list.
 *   {Set} [seedBases] Required by hideInSeed.
 *   {Set} [seedNotYetBlocked] Required by hideInSeed.
 *
 * @return {Array} The array of domains.
 */
function filterDomains(domains, options) {
  options = options || {};

  let search_filter = options.searchFilter,
    type_filter = options.typeFilter,
    status_filter = options.statusFilter,
    show_not_yet_blocked = options.showNotYetBlocked,
    hide_in_seed = options.hideInSeed,
    seedBases = options.seedBases,
    seedNotYetBlocked = options.seedNotYetBlocked;

  // lower case for case-insensitive matching
  if (search_filter) {
    search_filter = search_filter.toLowerCase();
  } else {
    search_filter = "";
  }

  /**
   * @param {String} domain The domain to test.
   * @return {Boolean} Does the domain pass filters?
   */
  function matchesFormFilters(domain) {
    const value = domains[domain];

    if (!show_not_yet_blocked) {
      // hide the not-yet-seen-on-enough-sites potential trackers
      if (value == "allow") {
        return false;
      }
    }

    if (hide_in_seed && seedBases && seedNotYetBlocked) {
      // if domain is not-yet-blocked, keep only if
      // domain and its base are not in seed data
      if (value == "allow") {
        if (seedBases.has(domain) || seedBases.has(getBaseDomain(domain))) {
          return false;
        }
      // otherwise, keep if domain and its base are either
      // not in seed data, or they were not-yet-blocked in seed data
      } else {
        if (seedBases.has(domain) && !seedNotYetBlocked.has(domain)) {
          return false;
        } else {
          let base = getBaseDomain(domain);
          if (seedBases.has(base) && !seedNotYetBlocked.has(base)) {
            return false;
          }
        }
      }
    }

    // filter by type
    if (type_filter) {
      if (type_filter == "user") {
        if (!value.startsWith("user")) {
          return false;
        }
      } else if (type_filter == "dnt") {
        if (value != "dnt") {
          return false;
        }
      } else if (type_filter == "-dnt") {
        if (value == "dnt") {
          return false;
        }
      }
    }

    // filter by status
    if (status_filter) {
      if (status_filter != value.replace("user_", "") && !(
        status_filter == "allow" && value == "dnt"
      )) {
        return false;
      }
    }

    // filter by search text
    // treat spaces as OR operators
    // treat "-" prefixes as NOT operators
    let textFilters = search_filter.split(" ").filter(i=>i); // remove empties

    // no text filters, we have a match
    if (!textFilters.length) {
      return true;
    }

    let positiveFilters = textFilters.filter(i => i[0] != "-"),
      ldomain = domain.toLowerCase();

    // if we have any positive filters, and we don't match any,
    // don't bother checking negative filters
    if (positiveFilters.length) {
      let result = positiveFilters.some(text => {
        return ldomain.indexOf(text) != -1;
      });
      if (!result) {
        return false;
      }
    }

    // we either matched a positive filter,
    // or we don't have any positive filters

    // if we match any negative filters, discard the match
    return textFilters.every(text => {
      if (text[0] != "-" || text == "-") {
        return true;
      }
      return ldomain.indexOf(text.slice(1)) == -1;
    });
  }

  return Object.keys(domains).filter(matchesFormFilters);
}

export {
  filterDomains,
};
