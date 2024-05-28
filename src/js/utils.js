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

import { extractHostFromURL, isThirdParty, getBaseDomain, URI } from "../lib/basedomain.js";

import mdfp from "./multiDomainFirstParties.js";

// TODO replace with Object.hasOwn() eventually
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn
function hasOwn(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Generic interface to make requests.
 *
 * @param {String} url the URL to get
 * @param {Function} callback the callback ({String?} error, {String?} response body text)
 */
function fetchResource(url, callback) {
  let options = {
    credentials: "omit",
    redirect: "error"
  };

  fetch(url, options).then(response => {
    if (!response.ok) {
      throw new Error("Non-2xx response status: " + response.status);
    }
    return response.text();

  }).then(data => {
    // success
    callback(null, data);

  }).catch(error => {
    callback(error, null);
  });
}

/**
 * Splits a given FQDN into an array of FQDNs present inside the FQDN,
 * ordered from the FQDN itself down to the eTLD+1.
 *
 * For example: ['a.b.eff.org', 'b.eff.org', 'eff.org']
 *
 * @param {String} fqdn the domain to split
 * @param {Boolean} [all] whether to go past eTLD+1: ['bbc.co.uk', 'co.uk', 'uk']
 *
 * @returns {Array}
 */
function explodeSubdomains(fqdn, all) {
  let subdomains = [],
    base_domain,
    dot = -1,
    piece;

  if (all) {
    base_domain = fqdn.slice(fqdn.lastIndexOf('.') + 1);
  } else {
    base_domain = getBaseDomain(fqdn);
  }

  for (;;) {
    piece = fqdn.slice(dot + 1);
    subdomains.push(piece);
    if (base_domain == piece) {
      break;
    }
    dot = fqdn.indexOf('.', dot + 1);
    if (dot < 0) {
      break;
    }
  }

  return subdomains;
}

/*
 * Estimates the max possible entropy of string.
 *
 * @param {String} str the string to compute entropy for
 * @returns {Integer} bits of entropy
 */
function estimateMaxEntropy(str) {
  // Don't process strings longer than MAX_LS_LEN_FOR_ENTROPY_EST.
  // Note that default quota for local storage is 5MB and
  // storing fonts, scripts or images in for local storage for
  // performance is not uncommon. We wouldn't want to estimate entropy
  // for 5M chars.
  const MAX_LS_LEN_FOR_ENTROPY_EST = 256;

  // common classes of characters that a string might belong to
  const SEPS = "._-x";
  const BIN = "01";
  const DEC = "0123456789";

  // these classes are case-insensitive
  const HEX = "abcdef" + DEC;
  const ALPHA = "abcdefghijklmnopqrstuvwxyz";
  const ALPHANUM = ALPHA + DEC;

  // these classes are case-sensitive
  const B64 = ALPHANUM + ALPHA.toUpperCase() + "/+";
  const URL = ALPHANUM + ALPHA.toUpperCase() + "~%";

  if (str.length > MAX_LS_LEN_FOR_ENTROPY_EST) {
    // Just return a higher-than-threshold entropy estimate.
    // We assume 1 bit per char, which will be well over the
    // threshold (33 bits).
    return str.length;
  }

  let max_symbols;

  // If all characters are upper or lower case, don't consider case when
  // computing entropy.
  let sameCase = (str.toLowerCase() == str) || (str.toUpperCase() == str);
  if (sameCase) {
    str = str.toLowerCase();
  }

  // If all the characters come from one of these common character groups,
  // assume that the group is the domain of possible characters.
  for (let chr_class of [BIN, DEC, HEX, ALPHA, ALPHANUM, B64, URL]) {
    let group = chr_class + SEPS;
    // Ignore separator characters when computing entropy. For example, Google
    // Analytics IDs look like "14103492.1964907".

    // flag to check if each character of input string belongs to the group in question
    let each_char_in_group = true;

    for (let ch of str) {
      if (!group.includes(ch)) {
        each_char_in_group = false;
        break;
      }
    }

    // if the flag resolves to true, we've found our culprit and can break out of the loop
    if (each_char_in_group) {
      max_symbols = chr_class.length;
      break;
    }
  }

  // If there's not an obvious class of characters, use the heuristic
  // "max char code - min char code"
  if (!max_symbols) {
    let charCodes = Array.prototype.map.call(str, function (ch) {
      return String.prototype.charCodeAt.apply(ch);
    });
    let min_char_code = Math.min.apply(Math, charCodes);
    let max_char_code = Math.max.apply(Math, charCodes);
    max_symbols = max_char_code - min_char_code + 1;
  }

  // the entropy is (entropy per character) * (number of characters)
  let max_bits = (Math.log(max_symbols) / Math.LN2) * str.length;

  return max_bits;
}

function oneSecond() {
  return 1000;
}

function oneMinute() {
  return oneSecond() * 60;
}

function oneHour() {
  return oneMinute() * 60;
}

function oneDay() {
  return oneHour() * 24;
}

function nDaysFromNow(n) {
  return Date.now() + (oneDay() * n);
}

function oneDayFromNow() {
  return nDaysFromNow(1);
}

function random(min, max) {
  if (max == null) {
    max = min;
    min = 0;
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

// from Underscore v1.6.0
// also lives in js/contentscripts/fingerprinting.js
function debounce(func, wait, immediate) {
  var timeout, args, context, timestamp, result;

  var later = function () {
    var last = Date.now() - timestamp;
    if (last < wait) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  };

  return function () {
    context = this; // eslint-disable-line consistent-this
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };
}

/**
 * Creates a rate-limited function that delays invoking `fn` until after
 * `interval` milliseconds have elapsed since the last time the rate-limited
 * function was invoked.
 *
 * Does not drop invocations (lossless), unlike `_.throttle`.
 *
 * Adapted from
 * http://stackoverflow.com/questions/23072815/throttle-javascript-function-calls-but-with-queuing-dont-discard-calls
 *
 * @param {Function} fn The function to rate-limit.
 * @param {number} interval The number of milliseconds to rate-limit invocations to.
 * @param {Object} context The context object (optional).
 * @returns {Function} Returns the new rate-limited function.
 */
function rateLimit(fn, interval, context) {
  let canInvoke = true,
    queue = [],
    timer_id,
    limited = function () {
      queue.push({
        context: context || this,
        arguments: Array.prototype.slice.call(arguments)
      });
      if (canInvoke) {
        canInvoke = false;
        timeEnd();
      }
    };

  function timeEnd() {
    let item;
    if (queue.length) {
      item = queue.splice(0, 1)[0];
      fn.apply(item.context, item.arguments); // invoke fn
      timer_id = setTimeout(timeEnd, interval);
    } else {
      canInvoke = true;
    }
  }

  // useful for debugging
  limited.cancel = function () {
    clearTimeout(timer_id);
    queue = [];
    canInvoke = true;
  };

  return limited;
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function sha1(input, callback) {
  return globalThis.crypto.subtle.digest(
    { name: "SHA-1", },
    new TextEncoder().encode(input)
  ).then(hashed => {
    return callback(buf2hex(hashed));
  });
}

/**
 * From https://github.com/mathiasbynens/CSS.escape/blob/4b25c283eaf4dd443f44a7096463e973d56dd1b2/css.escape.js
 * https://mths.be/cssescape v1.5.1 by @mathias | MIT license
 */
function cssEscape(value) {
  if (arguments.length == 0) {
    throw new TypeError('`CSS.escape` requires an argument.');
  }
  let string = String(value);
  let length = string.length;
  let index = -1;
  let codeUnit;
  let result = '';
  let firstCodeUnit = string.charCodeAt(0);

  if (
    // If the character is the first character and is a `-` (U+002D), and
    // there is no second character, […]
    length == 1 &&
    firstCodeUnit == 0x002D
  ) {
    return '\\' + string;
  }

  while (++index < length) {
    codeUnit = string.charCodeAt(index);
    // Note: there’s no need to special-case astral symbols, surrogate
    // pairs, or lone surrogates.

    // If the character is NULL (U+0000), then the REPLACEMENT CHARACTER
    // (U+FFFD).
    if (codeUnit == 0x0000) {
      result += '\uFFFD';
      continue;
    }

    if (
      // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
      // U+007F, […]
      (codeUnit >= 0x0001 && codeUnit <= 0x001F) || codeUnit == 0x007F ||
      // If the character is the first character and is in the range [0-9]
      // (U+0030 to U+0039), […]
      (index == 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      // If the character is the second character and is in the range [0-9]
      // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
      (
        index == 1 &&
        codeUnit >= 0x0030 && codeUnit <= 0x0039 &&
        firstCodeUnit == 0x002D
      )
    ) {
      // https://drafts.csswg.org/cssom/#escape-a-character-as-code-point
      result += '\\' + codeUnit.toString(16) + ' ';
      continue;
    }

    // If the character is not handled by one of the above rules and is
    // greater than or equal to U+0080, is `-` (U+002D) or `_` (U+005F), or
    // is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to
    // U+005A), or [a-z] (U+0061 to U+007A), […]
    if (
      codeUnit >= 0x0080 ||
      codeUnit == 0x002D ||
      codeUnit == 0x005F ||
      codeUnit >= 0x0030 && codeUnit <= 0x0039 ||
      codeUnit >= 0x0041 && codeUnit <= 0x005A ||
      codeUnit >= 0x0061 && codeUnit <= 0x007A
    ) {
      // the character itself
      result += string.charAt(index);
      continue;
    }

    // Otherwise, the escaped character.
    // https://drafts.csswg.org/cssom/#escape-a-character
    result += '\\' + string.charAt(index);
  }
  return result;
}

function parseCookie(str, opts) {
  if (!str) {
    return {};
  }

  opts = opts || {};

  let COOKIE_ATTRIBUTES = [
    "domain",
    "expires",
    "httponly",
    "max-age",
    "path",
    "samesite",
    "secure",
  ];

  let parsed = {},
    cookies = str.replace(/\n/g, ";").split(";");

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i],
      name,
      value,
      cut = cookie.indexOf("=");

    // it's a key=value pair
    if (cut != -1) {
      name = cookie.slice(0, cut).trim();
      value = cookie.slice(cut + 1).trim();

      // handle value quoting
      if (value[0] == '"') {
        value = value.slice(1, -1);
      }

    // not a key=value pair
    } else {
      if (opts.skipNonValues) {
        continue;
      }
      name = cookie.trim();
      value = "";
    }

    if (opts.skipAttributes &&
        COOKIE_ATTRIBUTES.indexOf(name.toLowerCase()) != -1) {
      continue;
    }

    if (!opts.noDecode) {
      let decode = opts.decode || decodeURIComponent;
      try {
        name = decode(name);
      } catch (e) {
        // invalid URL encoding probably (URIError: URI malformed)
        if (opts.skipInvalid) {
          continue;
        }
      }
      if (value) {
        try {
          value = decode(value);
        } catch (e) {
          // ditto
          if (opts.skipInvalid) {
            continue;
          }
        }
      }
    }

    if (!opts.noOverwrite || !hasOwn(parsed, name)) {
      parsed[name] = value;
    }
  }

  return parsed;
}

/**
 * Validates and normalizes user input for a domain list form field.
 *
 * @param {String} input user form input text
 *
 * @returns {(String|Boolean)} `false` if the input fails URL parsing,
 * otherwise the URL host
 */
function getHostFromDomainInput(input) {
  if (!input.startsWith("http://") && !input.startsWith("https://")) {
    input = "http://" + input;
  }

  if (!input.endsWith("/")) {
    input += "/";
  }

  let uri;

  try {
    uri = new URI(input);
  } catch (err) {
    return false;
  }

  return uri.host;
}

/**
 * check if a domain is third party
 * @param {String} domain1 an fqdn
 * @param {String} domain2 a second fqdn
 *
 * @return {Boolean} true if the domains are third party
 */
function isThirdPartyDomain(domain1, domain2) {
  if (isThirdParty(domain1, domain2)) {
    return !mdfp.isMultiDomainFirstParty(
      getBaseDomain(domain1),
      getBaseDomain(domain2)
    );
  }
  return false;
}

/**
 * Checks whether a given site hostname matches
 * any first party protections content scripts.
 *
 * @param {String} tab_host
 * @return {Boolean}
 */
let firstPartyProtectionsEnabled = (function () {
  let firstPartiesList;

  function getFirstParties() {
    let manifestJson = chrome.runtime.getManifest();
    let firstParties = [];

    for (let contentScriptObj of manifestJson.content_scripts) {
      // only include parts from content scripts that have firstparties entries
      if (contentScriptObj.js[0].includes("/firstparties/")) {
        let extractedUrls = [];
        for (let match of contentScriptObj.matches) {
          extractedUrls.push(extractHostFromURL(match));
        }
        firstParties.push(extractedUrls);
      }
    }
    return [].concat.apply([], firstParties);
  }

  return function (tab_host) {
    if (!firstPartiesList) {
      firstPartiesList = getFirstParties();
    }

    for (let url_pattern of firstPartiesList) {
      if (url_pattern.startsWith("*")) {
        if (tab_host.endsWith(url_pattern.slice(1))) {
          return true;
        }
      } else if (url_pattern == tab_host) {
        return true;
      }
    }
    return false;
  };
})();

/**
 * Checks whether a given URL is a special browser page.
 * TODO account for browser-specific pages:
 * https://github.com/hackademix/noscript/blob/a8b35486571933043bb62e90076436dff2a34cd2/src/lib/restricted.js
 *
 * @param {String} url
 *
 * @return {Boolean} whether the URL is restricted
 */
function isRestrictedUrl(url) {
  // permitted schemes from
  // https://developer.chrome.com/extensions/match_patterns
  return !(
    url.startsWith('http') || url.startsWith('file') || url.startsWith('ftp')
  );
}

function difference(arr1, arr2) {
  arr1 = arr1 || [];
  arr2 = arr2 || [];
  return arr1.filter(x => !arr2.includes(x));
}

/**
 * @returns {Array} items from arr1
 * followed by items from arr2 that were not already present in arr1
 */
function concatUniq(arr1, arr2) {
  arr1 = arr1 || [];
  arr2 = arr2 || [];
  return arr1.concat(arr2.filter(x => !arr1.includes(x)));
}

/**
 * Array.prototype.filter() for objects.
 *
 * @param {Object} obj
 * @param {Function} cb receives two arguments: current value, current key
 */
function filter(obj, cb) {
  let memo = {};
  for (let [key, value] of Object.entries(obj)) {
    if (cb(value, key)) {
      memo[key] = value;
    }
  }
  return memo;
}

let utils = {
  concatUniq,
  cssEscape,
  debounce,
  difference,
  estimateMaxEntropy,
  explodeSubdomains,
  fetchResource,
  filter,
  firstPartyProtectionsEnabled,
  getHostFromDomainInput,
  hasOwn,
  isRestrictedUrl,
  isThirdPartyDomain,
  nDaysFromNow,
  oneDay,
  oneDayFromNow,
  oneHour,
  oneMinute,
  oneSecond,
  parseCookie,
  random,
  rateLimit,
  sha1,
};

utils.isObject = function (obj) {
  let type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
};

// isFunction(), isString(), etc.
for (let name of ['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet']) {
  utils['is' + name] = function (x) {
    return toString.call(x) === '[object ' + name + ']';
  };
}

export default utils;
