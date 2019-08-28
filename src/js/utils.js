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
  var xhr = new XMLHttpRequest();
  if (opts) {
    _.each(opts, function (value, key) {
      xhr[key] = value;
    });
  }
  xhr.onload = function () {
    if (xhr.status == 200) {
      callback(null, xhr.response);
    } else {
      var error = {
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
 * Estimate the max possible entropy of str using min and max
 * char codes observed in the string.
 * Sensitive to case, e.g. bad1dea is different than BAD1DEA
 */
function estimateMaxEntropy(str) {
  /*
   * Don't process item + key's longer than LOCALSTORAGE_MAX_LEN_FOR_ENTROPY_EST.
   * Note that default quota for local storage is 5MB and
   * storing fonts, scripts or images in for local storage for
   * performance is not uncommon. We wouldn't want to estimate entropy
   * for 5M chars.
   */
  let MAX_LS_LEN_FOR_ENTROPY_EST = 256;

  // common classes of characters that a string might belong to
  let SEPS = "._-";
  let BIN = "01";
  let DEC = "0123456789";

  // these classes are case-insensitive
  let HEX = "abcdef" + DEC;
  let ALPHA = "abcdefghijklmnopqrstuvwxyz";
  let ALPHANUM = ALPHA + DEC;

  // these classes are case-sensitive
  let B64 = ALPHANUM + ALPHA.toUpperCase() + "/+";
  let URL = ALPHANUM + ALPHA.toUpperCase() + "~%";

  // separator character should be removed before the main calculations
  const sepsArray = SEPS.split('');
  sepsArray.forEach((char) => {
    while(str.includes(char)) {
      str = str.replace(char, "");
    };
  });

  if (str.length > MAX_LS_LEN_FOR_ENTROPY_EST) {
    /*
     * Just return a higher-than-threshold entropy estimate.
     * We assume 1 bit per char, which will be well over the
     * threshold (33 bits).
     */
    return str.length;
  }

  let maxSymbols;

  // If all characters are upper or lower case, don't consider case when
  // computing entropy.
  let sameCase = (str.toLowerCase() == str) || (str.toUpperCase() == str);
  if (sameCase) {
    str = str.toLowerCase();
  }

  // If all the characters come from one of these common character groups,
  // assume that the group is the domain of possible characters.
  for (let chr_class in [BIN, DEC, HEX, ALPHA, ALPHANUM, B64, URL]) {
    let group = chr_class + SEPS;
    // Ignore separator characters when computing entropy. For example, Google
    // Analytics IDs look like "14103492.1964907".
    if (str.split().every(val => group.includes(val))) {
      maxSymbols = chr_class.length;
    }
  }

  // If there's not an obvious class of characters, use the heuristic
  // "max char code - min char code"
  if (maxSymbols == undefined) {
    let charCodes = Array.prototype.map.call(str, function (ch) {
      return String.prototype.charCodeAt.apply(ch);
    });
    let minCharCode = Math.min.apply(Math, charCodes);
    let maxCharCode = Math.max.apply(Math, charCodes);
    maxSymbols = maxCharCode - minCharCode + 1;
  }

  // the entropy is (entropy per character) * (number of characters)
  let maxBits = (Math.log(maxSymbols)/Math.LN2) * str.length;
  /* console.log("Local storage item length:", str.length, "# symbols guess:", maxSymbols,
    "Max bits:", maxBits) */
  return maxBits;
}

// Adapted from https://gist.github.com/jaewook77/cd1e3aa9449d7ea4fb4f
// Find all common substrings more than 8 characters long, using DYNAMIC
// PROGRAMMING
function findCommonSubstrings(str1, str2) {
  /*
   Let D[i,j] be the length of the longest matching string suffix between
   str1[1]..str1[i] and a segment of str2 between str2[1]..str2[j].
   If the ith character in str1 doesn’t match the jth character in str2, then
   D[i,j] is zero to indicate that there is no matching suffix
   */

  // we only care about strings >= 8 chars
  let D = [], LCS = [], LCS_MIN = 8;

  // runs in O(M x N) time!
  for (let i = 0; i < str1.length; i++) {
    D[i] = [];
    for (let j = 0; j < str2.length; j++) {
      if (str1[i] == str2[j]) {
        if (i == 0 || j == 0) {
          D[i][j] = 1;
        } else {
          D[i][j] = D[i-1][j-1] + 1;
        }

        // store all common substrings longer than the minimum length
        if (D[i][j] == LCS_MIN) {
          LCS.push(str1.substring(i-D[i][j]+1, i+1));
        } else if (D[i][j] > LCS_MIN) {
          // remove the shorter substring and add the new, longer one
          LCS.pop();
          LCS.push(str1.substring(i-D[i][j]+1, i+1));
        }
      } else {
        D[i][j] = 0;
      }
    }
  }

  return LCS;
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

/************************************** exports */
var exports = {
  arrayBufferToBase64,
  estimateMaxEntropy,
  explodeSubdomains,
  findCommonSubstrings,
  getHostFromDomainInput,
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
