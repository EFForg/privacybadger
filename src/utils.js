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
  generateChecksum: function(lines)
  {
    // We cannot calculate MD5 checksums yet :-(
    return null;
  },
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

  getDocLink: function(linkID)
  {
    var Prefs = require("prefs").Prefs;
    var docLink = Prefs.documentation_link;
    return docLink.replace(/%LINK%/g, linkID).replace(/%LANG%/g, Utils.appLocale);
  },

  /**
  * removes an element or range of elements from an array and reindexes the 
  * array. Directly modifies the array in question. 
  **/
  removeElementFromArray: function(/*array*/ ary, /*int*/ from, /*int*/ to){
    var rest = ary.slice((to || from) + 1 || ary.length);
    ary.length = from < 0 ? ary.length + from : from;
    return ary.push.apply(ary, rest);
  },

  /**
  * Generic interface to make an XHR request 
  **/
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
   * check if privacy badger is enabled, optionally take an origin and 
   * check against the disabledSites list
   **/
  isPrivacyBadgerEnabled: function(origin){
    if(!JSON.parse(localStorage.enabled)){
      return false;
    } else if(origin) {
      if(localStorage.disabledSites && JSON.parse(localStorage.disabledSites).length > 0){
        var sites = JSON.parse(localStorage.disabledSites);
        for(var i = 0; i < sites.length; i++){
          if(sites[i] === origin){ return false; }
        }
      } 
      return true;
    } else {
      return true;
    }
  },

  /**
   * check if social widget replacement functionality is enabled
   * (TODO: actually make this return something based on a user-facing setting
   */
  isSocialWidgetReplacementEnabled: function() {
    return true;
  },

  /**
   * add an origin to the disabled sites list
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
};

return exports;
})(); //require scopes
