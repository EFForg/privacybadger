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

/**
 * Gets array of encountered origins.
 *
 * @param {Object} origins The starting set of domains to be filtered.
 * @param {String} [filter_text] Text to filter origins with.
 * @param {String} [type_filter] Type: user-controlled/DNT-compliant
 * @param {String} [status_filter] Status: blocked/cookieblocked/allowed
 * @param {Boolean} [show_not_yet_blocked] Whether to show domains your Badger
 * hasn't yet learned to block.
 *
 * @return {Array} The array of origins.
 */
function getOriginsArray(origins, filter_text, type_filter, status_filter, show_not_yet_blocked) {
  // Make sure filter_text is lower case for case-insensitive matching.
  if (filter_text) {
    filter_text = filter_text.toLowerCase();
  } else {
    filter_text = "";
  }

  /**
   * @param {String} origin The origin to test.
   * @return {Boolean} Does the origin pass filters?
   */
  function matchesFormFilters(origin) {
    const value = origins[origin];

    if (!show_not_yet_blocked) {
      // hide the not-yet-seen-on-enough-sites potential trackers
      if (value == "allow") {
        return false;
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
    let textFilters = filter_text.split(" ").filter(i=>i); // remove empties

    // no text filters, we have a match
    if (!textFilters.length) {
      return true;
    }

    let positiveFilters = textFilters.filter(i => i[0] != "-"),
      lorigin = origin.toLowerCase();

    // if we have any positive filters, and we don't match any,
    // don't bother checking negative filters
    if (positiveFilters.length) {
      let result = positiveFilters.some(text => {
        return lorigin.indexOf(text) != -1;
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
      return lorigin.indexOf(text.slice(1)) == -1;
    });
  }

  // Include only origins that match given filters.
  return Object.keys(origins).filter(matchesFormFilters);
}

export {
  getOriginsArray,
};
