/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2016 Electronic Frontier Foundation
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

require.scopes.surrogates = (function () {

const db = require('surrogatedb'),
  utils = require('utils');

const WIDGET_SURROGATES = utils.filter(db.hostnames, item => !!item.widgetName);

function _match_prefix(url, hostname, tokens) {
  let path_onwards = url.slice(url.indexOf(hostname) + hostname.length);
  for (const token of tokens) {
    if (path_onwards.startsWith(token)) {
      return db.surrogates[token];
    }
  }

  return false;
}

/**
 * Blocking tracking scripts (trackers) can cause parts of webpages to break.
 * Surrogate scripts are dummy pieces of JavaScript meant to supply just enough
 * of the original tracker's functionality to allow pages to continue working.
 *
 * This method gets called within request-blocking listeners:
 * It needs to be fast!
 *
 * @param {String} script_url The full URL of the script resource being requested.
 *
 * @param {String} script_hostname The hostname component of the script_url
 * parameter. This is an optimization: the calling context should already have
 * this information.
 *
 * @return {(String|Boolean)} Extension URL to the surrogate script
 * when there is a match; boolean false otherwise.
 */
function getSurrogateUri(script_url, script_hostname) {
  // do we have an entry for the script hostname?
  if (!utils.hasOwn(db.hostnames, script_hostname)) {
    return false;
  }

  const conf = db.hostnames[script_hostname];

  switch (conf.match) {

  // wildcard token:
  // matches any script URL for the hostname
  case db.MATCH_ANY: {
    return db.surrogates[conf.token];
  }

  // one or more suffix tokens:
  // does the script URL (querystring excluded) end with one of these tokens?
  case db.MATCH_SUFFIX: {
    const qs_start = script_url.indexOf('?');

    for (const token of conf.tokens) {
      // do any of the suffix tokens match the script URL?
      let match = false;

      if (qs_start == -1) {
        if (script_url.endsWith(token)) {
          match = true;
        }
      } else {
        if (script_url.endsWith(token, qs_start)) {
          match = true;
        }
      }

      // there is a match, return the surrogate code
      if (match) {
        return db.surrogates[token];
      }
    }

    return false;
  }

  // one or more prefix tokens:
  // does the script URL's path component begin with one of these tokens?
  case db.MATCH_PREFIX: {
    return _match_prefix(script_url, script_hostname, conf.tokens);
  }

  // MATCH_PREFIX with querystring parameter matching
  case db.MATCH_PREFIX_WITH_PARAMS: {
    let surl = _match_prefix(script_url, script_hostname, conf.tokens);

    if (!surl) {
      return false;
    }

    // check every key/value pair in conf.params against the querystring
    let qs = (new URL(script_url)).searchParams;
    for (let [key, value] of Object.entries(conf.params)) {
      // is the key present?
      if (value === true) {
        if (!qs.get(key)) {
          return false;
        }
      // is the key present and do the values match?
      } else if (utils.isString(value)) {
        if (qs.get(key) !== value) {
          return false;
        }
      }
    }

    return surl;
  }

  }

  return false;
}

const exports = {
  getSurrogateUri,
  WIDGET_SURROGATES
};

return exports;

}());
