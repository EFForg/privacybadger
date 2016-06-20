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
  

function Utils(badger) {
    this.badger = badger;
}

Utils.prototype = {
  getSettings: function(){ return this.badger.storage.getBadgerStorageObject('settings_map'); },
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

  oneHour: function(){
    return 1000 * 60 * 60;
  },
  
  oneDay: function(){
   return this.oneHour() * 24;
  },
  oneDayFromNow: function(){
    return Date.now() + this.oneDay();
  },

  /**
   * check if privacy badger is enabled, take an origin and
   * check against the disabledSites list
   *
   * @param {String} origin
   * @returns {Boolean} true if enabled
   **/
  isPrivacyBadgerEnabled: function(origin){
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    if(disabledSites && disabledSites.length > 0){
      for(var i = 0; i < disabledSites.length; i++){
        var site = disabledSites[i];
        if(site.startsWith("*")){
          if(window.getBaseDomain(site) === window.getBaseDomain(origin)){
            return false;
          }
        }
        if(disabledSites[i] === origin){
          return false;
        }
      }
    }
    return true;
  },
  
  /**
   * check if privacy badger is disabled, take an origin and
   * check against the disabledSites list
   *
   * @param {String} origin
   * @returns {Boolean} true if disabled
   **/
  isPrivacyBadgerDisabled: function(origin){
    return !this.isPrivacyBadgerEnabled(origin);
  },

  /**
   * check if social widget replacement functionality is enabled
   */
  isSocialWidgetReplacementEnabled: function() {
    return this.getSettings().getItem("socialWidgetReplacementEnabled");
  },

  /**
   * check if we should show the counter on the icon
   */
  showCounter: function() {
    return this.getSettings().getItem("showCounter");
  },

  /**
   * add an origin to the disabled sites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  disablePrivacyBadgerForOrigin: function(origin){
    var settings = this.getSettings();
    var disabledSites = settings.getItem('disabledSites');
    if(disabledSites.indexOf(origin) < 0){
      disabledSites.push(origin);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * interface to get the current whitelisted domains
   */
  listOriginsWherePrivacyBadgerIsDisabled: function(){
    return this.getSettings().getItem("disabledSites");
  },

  /**
   * remove an origin from the disabledSites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  enablePrivacyBadgerForOrigin: function(origin){
    var settings = this.getSettings();
    var disabledSites = settings.getItem("disabledSites");
    var idx = disabledSites.indexOf(origin);
    if(idx >= 0){
      removeElementFromArray(disabledSites, idx);
      settings.setItem("disabledSites", disabledSites);
    }
  },

  /**
   * Get a random number in the inclusive range min..max
   *
   * @param {Integer} minimum number to get
   * @param {Integer} maximum number to get
   **/
  getRandom: function(min, max){
    return min + Math.floor(Math.random() * (max - min + 1));
  },

  /**
  * Shortcut for document.getElementById(id)
  */
  E: function(id) {
    return document.getElementById(id);
  },


  /*
   * Estimate the max possible entropy of str using min and max
   * char codes observed in the string.
   * Tends to overestimate in many cases, e.g. hexadecimals.
   * Also, sensitive to case, e.g. bad1dea is different than BAD1DEA
   */
  estimateMaxEntropy: function(str) {
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
  },

  /**
   * Checks if local storage ( in dict) has any high-entropy keys
   *
   * @param lsItems Local storage dict
   * @returns {boolean} true if it seems there are supercookies
   */
  hasLocalStorageSuperCookie: function(lsItems) {
    var LOCALSTORAGE_ENTROPY_THRESHOLD = 33, // in bits
      estimatedEntropy = 0,
      lsKey = "",
      lsItem = "";
    for (lsKey in lsItems) {
      // send both key and value to entropy estimation
      lsItem = lsItems[lsKey];
      log("Checking localstorage item", lsKey, lsItem);
      estimatedEntropy += this.estimateMaxEntropy(lsKey + lsItem);
      if (estimatedEntropy > LOCALSTORAGE_ENTROPY_THRESHOLD){
        log("Found hi-entropy localStorage: ", estimatedEntropy, " bits, key: ", lsKey);
        return true;
      }
    }
    return false;
  },

  /**
   * check if there seems to be any type of Super Cookie
   *
   * @param storageItems Dict with storage items
   * @returns {*} true if there seems to be any Super cookie
   */
  hasSuperCookie: function(storageItems) {
    return (
      this.hasLocalStorageSuperCookie(storageItems.localStorageItems)
      // || Utils.hasLocalStorageSuperCookie(storageItems.indexedDBItems)
      // || Utils.hasLocalStorageSuperCookie(storageItems.fileSystemAPIItems)
      // TODO: Do we need separate functions for other supercookie vectors?
      // Let's wait until we implement them in the content script
    );
  },

  /**
   * Get Supercookie data from storage
   * @returns {*|{}} Dict with Supercookie domains
   */
  getSupercookieDomains: function() {
    return this.badger.storage.getBadgerStorageObject('supercookie_domains');
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



/************************************** exports */
var exports = {};

exports.removeElementFromArray = removeElementFromArray;
exports.makeURI = makeURI;
exports.xhrRequest = xhrRequest;
exports.explodeSubdomains = explodeSubdomains;
exports.Utils = Utils;

return exports;
/************************************** exports */
})(); //require scopes
