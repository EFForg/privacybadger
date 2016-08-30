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

 /* globals URI */

require.scopes.utils = (function() {
  

function Utils() {
}

Utils.prototype = {
  systemPrincipal: null,
  getString: function(id)
  {
    return id;
  },
  runAsync: function(callback, thisPtr)
  {
    var params = Array.prototype.slice.call(arguments, 2);
    window.setTimeout(function()
    {
      callback.apply(thisPtr, params);
    }, 0);
  },
  get appLocale()
  {
    var locale = chrome.i18n.getMessage("@@ui_locale").replace(/_/g, "-");
    this.__defineGetter__("appLocale", function() {return locale;});
    return this.appLocale;
  },

  checkLocalePrefixMatch: function(prefixes)
  {
    if (!prefixes){
      return null;
    }

    var list = prefixes.split(",");
    for (var i = 0; i < list.length; i++) {
      if (new RegExp("^" + list[i] + "\\b").test(this.appLocale)) {
        return list[i];
      }
    }

    return null;
  },

  /**
  * Shortcut for document.getElementById(id)
  */
  E: function(id) {
    return document.getElementById(id);
  }

};

/**
* Generic interface to make an XHR request
*
* @param url The url to get
* @param callback The callback to call after request has finished
* @param method GET/POST
*/
function xhrRequest(url, callback, method){
  if(!method){
    method = "GET";
  }
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function(){
    //on done
    if(xhr.readyState == xhr.DONE){
      //on success
      if(xhr.status == 200){
        callback(null,xhr.responseText);
      } else {
        var error = {status: xhr.status, message: xhr.responseText, object: xhr};
        callback(error,error.message);
      }
    }
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
function explodeSubdomains(fqdn, all){
  var baseDomain;
  if(all){
    baseDomain = fqdn.split('.').pop();
  } else {
    baseDomain = window.getBaseDomain(fqdn);
  }
  var baseLen = baseDomain.split('.').length;
  var parts = fqdn.split('.');
  var numLoops = parts.length - baseLen;
  var subdomains = [];
  for(var i=0; i<=numLoops; i++){
    subdomains.push(parts.slice(i).join('.'));
  }
  return subdomains;
}

/**
* Generator for URI objects
*
* @param {String} url the url to convert to URI
* @returns {URI|{scheme, spec, QueryInterface}}
*/
function makeURI(url){
  // URI defined in lib/basedomain.js
  return new URI(url);
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
function removeElementFromArray(/*array*/ ary, /*int*/ from, /*int*/ to){
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

  if (str.length > MAX_LS_LEN_FOR_ENTROPY_EST){
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
  var maxSymbolsGuess =  maxCharCode - minCharCode + 1;
  var maxCombinations = Math.pow(maxSymbolsGuess, str.length);
  var maxBits = Math.log(maxCombinations)/Math.LN2;
  /* console.log("Local storage item length:", str.length, "# symbols guess:", maxSymbolsGuess,
    "Max # Combinations:", maxCombinations, "Max bits:", maxBits) */
  return maxBits;  // May return Infinity when the content is too long.
}

/**
 * Get a random number in the inclusive range min..max
 *
 * @param {Integer} minimum number to get
 * @param {Integer} maximum number to get
 **/
function getRandom(min, max){
  return min + Math.floor(Math.random() * (max - min + 1));
}

function oneHour(){
  return 1000 * 60 * 60;
}

function oneDay(){
  return oneHour() * 24;
}

function oneDayFromNow(){
  return Date.now() + oneDay();
}


/************************************** exports */
var exports = {};

exports.oneHour = oneHour;
exports.oneDay = oneDay;
exports.oneDayFromNow = oneDayFromNow;
exports.removeElementFromArray = removeElementFromArray;
exports.estimateMaxEntropy = estimateMaxEntropy;
exports.makeURI = makeURI;
exports.xhrRequest = xhrRequest;
exports.explodeSubdomains = explodeSubdomains;
exports.getRandom = getRandom;
exports.Utils = Utils;

return exports;
/************************************** exports */
})(); //require scopes
