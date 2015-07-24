/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
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

/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */
require.scopes["utils"] = (function() {
  
var exports = {};
var Utils = exports.Utils = {
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
    this.__defineGetter__("appLocale", function() {return locale});
    return this.appLocale;
  },

  // TODO: Implement
  generateChecksum: function(lines)
  {
    // We cannot calculate MD5 checksums yet :-(
    return null;
  },

  /**
   * Generator for URI objects
   *
   * @param url The url to analyze it with
   * @returns {*|{scheme, spec, QueryInterface}}
   */
  makeURI: function(url)
  {
    return Services.io.newURI(url);
  },

  checkLocalePrefixMatch: function(prefixes)
  {
    if (!prefixes)
      return null;

    var list = prefixes.split(",");
    for (var i = 0; i < list.length; i++)
      if (new RegExp("^" + list[i] + "\\b").test(this.appLocale))
        return list[i];

    return null;
  },

  // not used
  chooseFilterSubscription: function(subscriptions)
  {
    var selectedItem = null;
    var selectedPrefix = null;
    var matchCount = 0;
    for (var i = 0; i < subscriptions.length; i++)
    {
      var subscription = subscriptions[i];
      if (!selectedItem)
        selectedItem = subscription;

      var prefix = require("utils").Utils.checkLocalePrefixMatch(subscription.getAttribute("prefixes"));
      if (prefix)
      {
        if (!selectedPrefix || selectedPrefix.length < prefix.length)
        {
          selectedItem = subscription;
          selectedPrefix = prefix;
          matchCount = 1;
        }
        else if (selectedPrefix && selectedPrefix.length == prefix.length)
        {
          matchCount++;

          // If multiple items have a matching prefix of the same length:
          // Select one of the items randomly, probability should be the same
          // for all items. So we replace the previous match here with
          // probability 1/N (N being the number of matches).
          if (Math.random() * matchCount < 1)
          {
            selectedItem = subscription;
            selectedPrefix = prefix;
          }
        }
      }
    }
    return selectedItem;
  },

  // not used
  getDocLink: function(linkID)
  {
    var Prefs = require("prefs").Prefs;
    var docLink = Prefs.documentation_link;
    return docLink.replace(/%LINK%/g, linkID).replace(/%LANG%/g, Utils.appLocale);
  },

  /**
   * removes an element or range of elements from an array and reindexes the
   * array. Directly modifies the array in question.
   *
   * @param ary The array to modify
   * @param {Integer} Start item of the hole
   * @param {Integer} End item of the hole
   * @returns {*}
   */
  removeElementFromArray: function(/*array*/ ary, /*int*/ from, /*int*/ to){
    var rest = ary.slice((to || from) + 1 || ary.length);
    ary.length = from < 0 ? ary.length + from : from;
    return ary.push.apply(ary, rest);
  },

  /**
   * Generic interface to make an XHR request
   *
   * @param url The url to get
   * @param callback The callback to call after request has finished
   * @param method GET/POST
   */
  xhrRequest: function(url,callback,method){
    if(!method){
      var method = "GET";
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
    }
    xhr.open(method, url, true);
    xhr.send();
  },

  /**
   * check if privacy badger is enabled, take an origin and
   * check against the disabledSites list
   *
   * @param {String} origin
   * @returns {Boolean} true if disabled
   **/
  isPrivacyBadgerEnabled: function(origin){
    if(localStorage.disabledSites && JSON.parse(localStorage.disabledSites).length > 0){
      var sites = JSON.parse(localStorage.disabledSites);
      for(var i = 0; i < sites.length; i++){
        if(sites[i] === origin){ return false; }
      }
    }
    return true;
  },

  /**
   * check if social widget replacement functionality is enabled
   */
  isSocialWidgetReplacementEnabled: function() {
    return JSON.parse(localStorage.socialWidgetReplacementEnabled);
  },

  /**
   * add an origin to the disabled sites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  disablePrivacyBadgerForOrigin: function(origin){
    if(localStorage.disabledSites === undefined){
      localStorage.disabledSites = JSON.stringify([origin]);
      return;
    }
    var disabledSites = JSON.parse(localStorage.disabledSites);
    if(disabledSites.indexOf(origin) < 0){
      disabledSites.push(origin);
      localStorage.disabledSites = JSON.stringify(disabledSites);
    }
  },

  /**
   * remove an origin from the disabledSites list
   *
   * @param {String} origin The origin to disable the PB for
   **/
  enablePrivacyBadgerForOrigin: function(origin){
    if(localStorage.disabledSites === undefined){
      return;
    }
    var disabledSites = JSON.parse(localStorage.disabledSites);
    var idx = disabledSites.indexOf(origin);
    if(idx >= 0){
      Utils.removeElementFromArray(disabledSites, idx);
      localStorage.disabledSites = JSON.stringify(disabledSites);
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
      return String.prototype.charCodeAt.apply(ch)
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
    for (var lsKey in lsItems) {
      // send both key and value to entropy estimation
      lsItem = lsItems[lsKey];
      // console.log("Checking localstorage item", lsKey, lsItem);
      estimatedEntropy += Utils.estimateMaxEntropy(lsKey + lsItem);
      if (estimatedEntropy > LOCALSTORAGE_ENTROPY_THRESHOLD){
        // console.log("Found hi-entropy localStorage: ", estimatedEntropy, " bits, key: ", lsKey);
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
      Utils.hasLocalStorageSuperCookie(storageItems.localStorageItems)
      // || Utils.hasLocalStorageSuperCookie(storageItems.indexedDBItems)
      // || Utils.hasLocalStorageSuperCookie(storageItems.fileSystemAPIItems)
      // TODO: Do we need separate functions for other supercookie vectors?
      // Let's wait until we implement them in the content script
    );
  },

  /**
   * Get Supercookie data from local Storage
   * @returns {*|{}} Dict with Supercookie domains
   */
  getSupercookieDomains: function() {
    return JSON.parse(localStorage.getItem("supercookieDomains")) || {};
  }

};

return exports;
})(); //require scopes
