/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 *
 * Derived from Adblock Plus
 * Copyright (C) 2006-2013 Eyeo GmbH
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

/* globals URI:false */

require.scopes.utils = (function() {

let mdfp = require("multiDomainFP");

/**
 * Generic interface to make an XHR request
 *
 * @param {String} url The url to get
 * @param {Function} callback The callback to call after request has finished
 * @param {String} method GET/POST
 * @param {Object} opts XMLHttpRequest options
 */
function xhrRequest(url, callback, method, opts) {
  if (!method) {
    method = "GET";
  }
  if (!opts) {
    opts = {};
  }

  let xhr = new XMLHttpRequest();

  for (let key in opts) {
    if (opts.hasOwnProperty(key)) {
      xhr[key] = opts[key];
    }
  }

  xhr.onload = function () {
    if (xhr.status == 200) {
      callback(null, xhr.response);
    } else {
      let error = {
        status: xhr.status,
        message: xhr.response,
        object: xhr
      };
      callback(error, error.message);
    }
  };

  // triggered by network problems
  xhr.onerror = function () {
    callback({ status: 0, message: "", object: xhr }, "");
  };

  xhr.open(method, url, true);
  xhr.send();
}

/**
 * Converts binary data to base64-encoded text suitable for use in data URIs.
 *
 * Adapted from https://stackoverflow.com/a/9458996.
 *
 * @param {ArrayBuffer} buffer binary data
 *
 * @returns {String} base64-encoded text
 */
function arrayBufferToBase64(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Return an array of all subdomains in an FQDN, ordered from the FQDN to the
 * eTLD+1. e.g. [a.b.eff.org, b.eff.org, eff.org]
 * if 'all' is passed in then the array will include all domain levels, not
 * just down to the base domain
 * @param {String} fqdn the domain to split
 * @param {boolean} all whether to include all domain levels
 * @returns {Array} the subdomains
 */
function explodeSubdomains(fqdn, all) {
  var baseDomain;
  if (all) {
    baseDomain = fqdn.split('.').pop();
  } else {
    baseDomain = window.getBaseDomain(fqdn);
  }
  var baseLen = baseDomain.split('.').length;
  var parts = fqdn.split('.');
  var numLoops = parts.length - baseLen;
  var subdomains = [];
  for (var i=0; i<=numLoops; i++) {
    subdomains.push(parts.slice(i).join('.'));
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
      timer_id = window.setTimeout(timeEnd, interval);
    } else {
      canInvoke = true;
    }
  }

  // useful for debugging
  limited.cancel = function () {
    window.clearTimeout(timer_id);
    queue = [];
    canInvoke = true;
  };

  return limited;
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function sha1(input, callback) {
  return window.crypto.subtle.digest(
    { name: "SHA-1", },
    new TextEncoder().encode(input)
  ).then(hashed => {
    return callback(buf2hex(hashed));
  });
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

    if (!opts.noOverwrite || !parsed.hasOwnProperty(name)) {
      parsed[name] = value;
    }
  }

  return parsed;
}

function getHostFromDomainInput(input) {
  if (!input.startsWith("http")) {
    input = "http://" + input;
  }

  if (!input.endsWith("/")) {
    input += "/";
  }

  try {
    var uri = new URI(input);
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
  if (window.isThirdParty(domain1, domain2)) {
    return !mdfp.isMultiDomainFirstParty(
      window.getBaseDomain(domain1),
      window.getBaseDomain(domain2)
    );
  }
  return false;
}


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

/************************************** exports */
let exports = {
  arrayBufferToBase64,
  estimateMaxEntropy,
  explodeSubdomains,
  getHostFromDomainInput,
  isRestrictedUrl,
  isThirdPartyDomain,
  nDaysFromNow,
  oneDay,
  oneDayFromNow,
  oneHour,
  oneMinute,
  oneSecond,
  parseCookie,
  rateLimit,
  sha1,
  xhrRequest,
};
return exports;
/************************************** exports */
})(); //require scopes
