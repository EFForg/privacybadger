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

/**
* Generic interface to make an XHR request
*
* @param url The url to get
* @param callback The callback to call after request has finished
* @param method GET/POST
*/
function xhrRequest(url, callback, method) {
  if (!method) {
    method = "GET";
  }
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    if (xhr.status == 200) {
      callback(null, xhr.responseText);
    } else {
      var error = {
        status: xhr.status,
        message: xhr.responseText,
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
* Return an array of all subdomains in an FQDN, ordered from the FQDN to the
* eTLD+1. e.g. [a.b.eff.org, b.eff.org, eff.org]
* if 'all' is passed in then the array will include all domain levels, not
* just down to the base domain
* @param {String} fqdn the domain to split
* @param {boolean} all whether to include all domain levels
*
**/
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

/**
* removes an element or range of elements from an array and reindexes the
* array. Directly modifies the array in question.
*
* @param ary The array to modify
* @param {Integer} Start item of the hole
* @param {Integer} End item of the hole
* @returns {*}
*/
function removeElementFromArray(/*array*/ ary, /*int*/ from, /*int*/ to) {
  var rest = ary.slice((to || from) + 1 || ary.length);
  ary.length = from < 0 ? ary.length + from : from;
  return ary.push.apply(ary, rest);
}

/*
 * Estimate the max possible entropy of str using min and max
 * char codes observed in the string.
 * Tends to overestimate in many cases, e.g. hexadecimals.
 * Also, sensitive to case, e.g. bad1dea is different than BAD1DEA
 */
function estimateMaxEntropy(str) {
  /*
   * Don't process item + key's longer than LOCALSTORAGE_MAX_LEN_FOR_ENTROPY_EST.
   * Note that default quota for local storage is 5MB and
   * storing fonts, scripts or images in for local storage for
   * performance is not uncommon. We wouldn't want to estimate entropy
   * for 5M chars.
   */
  var MAX_LS_LEN_FOR_ENTROPY_EST = 256;

  if (str.length > MAX_LS_LEN_FOR_ENTROPY_EST) {
    /*
     * Just return a higher-than-threshold entropy estimate.
     * We assume 1 bit per char, which will be well over the
     * threshold (33 bits).
     */
    return str.length;
  }

  var charCodes = Array.prototype.map.call(str, function (ch) {
    return String.prototype.charCodeAt.apply(ch);
  });
  var minCharCode = Math.min.apply(Math, charCodes);
  var maxCharCode = Math.max.apply(Math, charCodes);
  // Guess the # of possible symbols, e.g. for 0101 it'd be 2.
  var maxSymbolsGuess = maxCharCode - minCharCode + 1;
  var maxCombinations = Math.pow(maxSymbolsGuess, str.length);
  var maxBits = Math.log(maxCombinations)/Math.LN2;
  /* console.log("Local storage item length:", str.length, "# symbols guess:", maxSymbolsGuess,
    "Max # Combinations:", maxCombinations, "Max bits:", maxBits) */
  return maxBits; // May return Infinity when the content is too long.
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
 **/
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

/************************************** exports */
var exports = {};

exports.estimateMaxEntropy = estimateMaxEntropy;
exports.explodeSubdomains = explodeSubdomains;
exports.getHostFromDomainInput = getHostFromDomainInput;
exports.nDaysFromNow = nDaysFromNow;
exports.oneDayFromNow = oneDayFromNow;
exports.oneDay = oneDay;
exports.oneHour = oneHour;
exports.oneMinute = oneMinute;
exports.oneSecond = oneSecond;
exports.parseCookie = parseCookie;
exports.rateLimit = rateLimit;
exports.removeElementFromArray = removeElementFromArray;
exports.sha1 = sha1;
exports.xhrRequest = xhrRequest;

return exports;
/************************************** exports */
})(); //require scopes
