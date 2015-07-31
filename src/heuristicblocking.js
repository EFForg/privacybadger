/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

var backgroundPage = chrome.extension.getBackgroundPage();
var require = backgroundPage.require;
var imports = ["privacyHashesDoExist", "unblockOrigin", "checkPrivacyBadgerPolicy"];

for (var i = 0; i < imports.length; i++){
  window[imports[i]] = backgroundPage[imports[i]];
}

with(require("filterClasses")) {
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses")) {
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
  this.SpecialSubscription = SpecialSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var matcherStore = require("matcher").matcherStore;
var Synchronizer = require("synchronizer").Synchronizer;
var BlockedDomainList = require("blockedDomainList").BlockedDomainList;
var Utils = require("utils").Utils;
var tabOrigins = { }; // TODO roll into tabData?
var cookieSentOriginFrequency = { };
var cookieSetOriginFrequency = { };
var httpRequestOriginFrequency = { };
var prevalenceThreshold = 3;

// variables for alpha test extension
var lastSentXhr = { };
var testing = false;
var testThreshold = 3;
var numMinutesToWait = 120;
var whitelistName =  "https://www.eff.org/files/cookieblocklist.txt";
// local storage for alpha test extension
// todo? not even close to CSPRNG :)
// todo? this is async; not ideal but it'll do
var uniqueId = null;
chrome.storage.local.get('pbdata', function(items) {
  uniqueId = items['pbdata'];
  if (!(uniqueId)) {
    var randId = Math.floor(Math.random()*16777215).toString(16);
    uniqueId = randId;
    chrome.storage.local.set({'pbdata':randId}, function() {
      console.log("setting local id to " + uniqueId);
    });
  }
});

/******* FUNCTIONS FOR TESTING BEGIN HERE ********/
/**
 * testing function for feedback to servers
 *
 * @param params data to send
 */
var sendXHR = function(params) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://observatory.eff.org/pbdata.py", true);
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200){
        console.log("Successfully submitted params: " + params);
      } else {
        console.log("Error submitting params: " + params);
      }
    }
  }
  xhr.send(params);
}

// this is missing parameters, and is not in use in the live extension
/**
 * Sends testing data. Non-functional
 */
var sendTestingData = function() {
    var cookieSentPrevalence = 0;
    if (origin in cookieSentOriginFrequency) {
      cookieSentPrevalence = Object.keys(cookieSentOriginFrequency[origin]).length;
    }
    var cookieSetPrevalence = 0;
    if (origin in cookieSetOriginFrequency) {
      cookieSetPrevalence = Object.keys(cookieSetOriginFrequency[origin]).length;
    }
    var reqParams = []
    reqParams.push("origin="+origin);
    reqParams.push("thirdpartynum="+httpRequestPrevalence);
    reqParams.push("cookiesentnum="+cookieSentPrevalence);
    reqParams.push("cookiereceivednum="+cookieSetPrevalence);
    reqParams.push("id="+uniqueId);
    var params = reqParams.join("&");
    sendXHR(params);
    console.log("With id " + uniqueId + ", Request to " + origin + ", seen on " + httpRequestPrevalence + " third-party origins, sent cookies on " + cookieSentPrevalence + ", set cookies on " + cookieSetPrevalence);
}

/**
 * Check if a origin should be sent. Non-functional
 *
 * @param {String} origin Origin to test
 * @param httpRequestPrevalence Tested against the testThreshold
 * @returns {boolean} true if this should be sent
 */
var needToSendOrigin = function(origin, httpRequestPrevalence) {
  // don't send third party domains that don't meet minimum test threshold
  if (httpRequestPrevalence < testThreshold) {
    return false;
  }
  // only send an origin every 6 hours
  var currentTime = new Date();
  if (!(origin in lastSentXhr)) {
    lastSentXhr[origin] = currentTime;
    return true;
  }
  var diff_minutes = (currentTime - lastSentXhr[origin]) / (1000 * 60);
  if (diff_minutes > numMinutesToWait) {
    console.log("Last submitted " + origin + " " + diff_minutes + " minutes ago. Submitting again...");
    lastSentXhr[origin] = currentTime;
    return true;
  }
  return false;
}
/******* FUNCTIONS FOR TESTING END HERE ********/

/**
 * Adds Cookie blocking filters if origin is in cookieblocklist.txt
 *
 * @param {String} origin Origin to check
 */
function addFiltersFromWhitelistToCookieblock(origin){
  var filters = matcherStore.combinedMatcherStore[whitelistName].whitelist.keywordByFilter;
  for(filter in filters){
    var domain = getDomainFromFilter(filter);
    var baseDomain = getBaseDomain(origin);
    if (domain == origin || baseDomain == domain) {
      setupCookieBlocking(domain);
    }
  }
}

/**
 * Extract the domain from an AdBlock style filter
 *
 * @param {String} filter adBlock style filter
 * @returns {String} The Url in the filter
 */
function getDomainFromFilter(filter){
  return filter.match('[|][|]([^\^]*)')[1]
}

/**
 * Decide if to blacklist and add blacklist filters
 *
 * @param {String} origin The origin URL to add (host)
 * @param {String} fqdn The FQDN
 */
var blacklistOrigin = function(origin, fqdn) {
  // Heuristic subscription
  if (!("frequencyHeuristic" in FilterStorage.knownSubscriptions)) {
    console.log("Error. Could not blacklist origin because no heuristic subscription found");
    return;
  }

  //check for dnt-policy and whitelist domain if it exists
  if(!BlockedDomainList.hasDomain(fqdn)){
    checkPrivacyBadgerPolicy(fqdn, function(success){
      if(success){
        console.log('adding', fqdn, 'to user whitelist due to badgerpolicy.txt');
        unblockOrigin(fqdn);
      } else {
        BlockedDomainList.addDomain(fqdn);
        addFiltersFromWhitelistToCookieblock(origin)
        // this variable seems a little unnessecary...
        var heuristicSubscription = FilterStorage.knownSubscriptions["frequencyHeuristic"];
        // Create an ABP filter to block this origin 
        var filter = this.Filter.fromText("||" + origin + "^$third-party");
        filter.disabled = false;
        FilterStorage.addFilter(filter, heuristicSubscription);
      }
    });
  }  
};


// This maps cookies to a rough estimate of how many bits of 
// identifying info we might be letting past by allowing them.
// (map values to lower case before using)
// We need something better than this eventually, informed by more real world data!
var lowEntropyCookieValues = {
 "":3,
 "nodata":3,
 "no_data":3,
 "yes":3,
 "no":3,
 "true":3,
 "false":3,
 "opt-out":3,
 "optout":3,
 "opt_out":3,
 "0":4,
 "1":4,
 "2":4,
 "3":4,
 "4":4,
 "5":4,
 "6":4,
 "7":4,
 "8":4,
 "9":4,
 // ISO 639-1 language codes
 "aa":8,
 "ab":8,
 "ae":8,
 "af":8,
 "af":8,
 "ak":8,
 "am":8,
 "an":8,
 "ar":8,
 "as":8,
 "as":8,
 "av":8,
 "ay":8,
 "az":8,
 "ba":8,
 "be":8,
 "bg":8,
 "bh":8,
 "bi":8,
 "bm":8,
 "bn":8,
 "bo":8,
 "br":8,
 "bs":8,
 "by":8,
 "by":8,
 "ca":8,
 "ce":8,
 "ch":8,
 "co":8,
 "cr":8,
 "cs":8,
 "cu":8,
 "cv":8,
 "cy":8,
 "da":8,
 "de":8,
 "de":8,
 "dv":8,
 "dz":8,
 "ee":8,
 "el":8,
 "en":8,
 "eo":8,
 "es":8,
 "et":8,
 "eu":8,
 "fa":8,
 "ff":8,
 "fi":8,
 "fj":8,
 "fo":8,
 "fr":8,
 "fy":8,
 "ga":8,
 "gd":8,
 "gl":8,
 "gn":8,
 "gu":8,
 "gv":8,
 "ha":8,
 "he":8,
 "hi":8,
 "ho":8,
 "hr":8,
 "ht":8,
 "hu":8,
 "hy":8,
 "hz":8,
 "ia":8,
 "id":8,
 "ie":8,
 "ig":8,
 "ii":8,
 "ik":8,
 "in":8,
 "in":8,
 "in":8,
 "io":8,
 "is":8,
 "is":8,
 "is":8,
 "is":8,
 "is":8,
 "is":8,
 "is":8,
 "is":8,
 "it":8,
 "iu":8,
 "ja":8,
 "jv":8,
 "ka":8,
 "kg":8,
 "ki":8,
 "kj":8,
 "kk":8,
 "kl":8,
 "km":8,
 "kn":8,
 "ko":8,
 "kr":8,
 "ks":8,
 "ku":8,
 "kv":8,
 "kw":8,
 "ky":8,
 "la":8,
 "lb":8,
 "lg":8,
 "li":8,
 "ln":8,
 "lo":8,
 "lt":8,
 "lu":8,
 "lv":8,
 "mg":8,
 "mh":8,
 "mi":8,
 "mk":8,
 "ml":8,
 "mn":8,
 "mr":8,
 "ms":8,
 "mt":8,
 "my":8,
 "na":8,
 "nb":8,
 "nd":8,
 "ne":8,
 "ng":8,
 "nl":8,
 "nn":8,
 "no":8,
 "nr":8,
 "nv":8,
 "ny":8,
 "oc":8,
 "of":8,
 "oj":8,
 "om":8,
 "or":8,
 "os":8,
 "pa":8,
 "pi":8,
 "pl":8,
 "ps":8,
 "pt":8,
 "qu":8,
 "rm":8,
 "rn":8,
 "ro":8,
 "ru":8,
 "rw":8,
 "sa":8,
 "sc":8,
 "sd":8,
 "se":8,
 "sg":8,
 "si":8,
 "sk":8,
 "sl":8,
 "sm":8,
 "sn":8,
 "so":8,
 "sq":8,
 "sr":8,
 "ss":8,
 "st":8,
 "su":8,
 "sv":8,
 "sw":8,
 "ta":8,
 "te":8,
 "te":8,
 "tg":8,
 "th":8,
 "ti":8,
 "tk":8,
 "tl":8,
 "tn":8,
 "to":8,
 "tr":8,
 "ts":8,
 "tt":8,
 "tw":8,
 "ty":8,
 "ug":8,
 "uk":8,
 "ur":8,
 "uz":8,
 "ve":8,
 "vi":8,
 "vo":8,
 "wa":8,
 "wo":8,
 "xh":8,
 "yi":8,
 "yo":8,
 "za":8,
 "zh":8,
 "zu":8
};

/**
 * Extract cookies from onBeforeSendHeaders
 *
 * https://developer.chrome.com/extensions/webRequest#event-onBeforeSendHeaders
 *
 * @param details Details for onBeforeSendHeaders
 * @returns {*} False or a string combining all Cookies
 */
var extractCookieString = function(details) {
  // @details are those from onBeforeSendHeaders
  // The RFC allows cookies to be separated by ; or , (!!@$#!) but chrome uses ;
  if(details.requestHeaders) {
    var headers = details.requestHeaders;
  } else if(details.responseHeaders) {
    var headers = details.responseHeaders;
  } else {
    console.log("A request was made with no headers! Crazy!");
    console.log(details);
    return false;
  }

  var cookies = "";

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (header.name == "Cookie" || header.name == "Set-Cookie" ) {
      if (!cookies) {
        cookies = header.value;
      } else {
        // Should not happen?  Except perhaps due to crazy extensions?
        cookies = cookies + ";" + header.value;
      }
    }
  }

  return cookies;
};

/**
 * Decides if a origin has tracking
 *
 * @param details onBeforeSendHeaders details
 * @param origin The URL
 * @returns {Booolean} true if it has tracking
 */
var hasTracking = function(details, origin) {
  return (hasCookieTracking(details, origin) || hasSupercookieTracking(details, origin));
};

/**
 * Check if SuperCookie tracking is done
 *
 * @param details onBeforeSendHeaders details
 * @param origin The URL
 * @returns {*} null or the supercookie data structure
 */
var hasSupercookieTracking = function(details, origin) {
  /* This function is called before we hear from the localstorage check in supercookie.js.
   * So, we're missing the scripts which may have supercookies.
   * Alternatively, we could record the prevalence when we find hi-entropy localstorage items
   * and check that record to see if the frame hasSupercookieTracking.
   */
  var frameData = getFrameData(details.tabId, details.frameId);
  if (frameData){
    // console.log("hasSupercookieTracking (frameData)", frameData.superCookie, origin, details.tabId, details.frameId);
    return frameData.superCookie;
  }else{ // Check localStorage if we can't find the frame in frameData
    var supercookieDomains = Utils.getSupercookieDomains();
    // console.log("hasSupercookieTracking (frameData)", supercookieDomains[origin], origin, details.tabId, details.frameId);
    return supercookieDomains[origin];
  }
};

const MAX_COOKIE_ENTROPY = 12;
/**
 * Check if page is doing cookie tracking. Doing this by estimating the entropy of the cookies
 *
 * @param details details onBeforeSendHeaders details
 * @param {String} origin URL
 * @returns {boolean} true if it has cookie tracking
 */
var hasCookieTracking = function(details, origin) {
  // @details are those from onBeforeSendHeaders

  var cookies = extractCookieString(details);
  if (!cookies) {
    //console.log(details);
    return false;
  }
  cookies = cookies.split(";");
  var hasCookies = false;
  var estimatedEntropy = 0;
  for (var n = 0; n < cookies.length; n++) {
    // XXX urgh I can't believe we're parsing cookies.  Probably wrong
    // what if the value has spaces in it?
    hasCookies = true;
    var c = cookies[n].trim();
    var cut = c.indexOf("=");
    var name = c.slice(0,cut);
    var value = c.slice(cut+1);
    var lvalue = value.toLowerCase();
    if (!(lvalue in lowEntropyCookieValues)) {
      return true;
    }
    if(lvalue in lowEntropyCookieValues){
      estimatedEntropy += lowEntropyCookieValues[lvalue];
    }
  }
  if (hasCookies) {
     console.log("All cookies for " + origin + " deemed low entropy...");
     for (var n = 0; n < cookies.length; n++) {
        console.log("    " + cookies[n]);
     }
     if (estimatedEntropy > MAX_COOKIE_ENTROPY) {
       console.log("But total estimated entropy is " + estimatedEntropy + " bits, so blocking");
       return true;
     }
  } else {
    console.log(origin, "has no cookies!");
  }
  return false;
};

/**
 * Increment counts of how many first party domains we've seen a third party track on
 * Ignore requests that are outside a tabbed window
 *
 * @param details are those from onBeforeSendHeaders
 * @returns {{}}
 */
var heuristicBlockingAccounting = function(details) {
  if(details.tabId < 0){
    return { };
  }
 

  var fqdn = new URI(details.url).host;
  var origin = getBaseDomain(fqdn);

  var action = activeMatchers.getAction(details.tabId, fqdn);
  if(action && action != "noaction"){ console.log("action for", fqdn, action); return {}; }
  
  // Save the origin associated with the tab if this is a main window request
  if(details.type == "main_frame") {
    //console.log("Origin: " + origin + "\tURL: " + details.url);
    tabOrigins[details.tabId] = origin;
    return { };
  }
  else {
    var tabOrigin = tabOrigins[details.tabId];
    // Ignore first-party requests
    if (!tabOrigin || origin == tabOrigin){
      return { };
    }
    // if there are no tracking cookies or similar things, ignore
    if (!hasTracking(details, origin)){
      return { };
    }
    backgroundPage.setTrackingFlag(details.tabId, fqdn);
    recordPrevalence(fqdn, origin, tabOrigin);
  }
};

/**
 * Record HTTP request prevalence. Block a tracker if seen on more than [prevalenceThreshold] pages
 *
 * @param fqdn Host
 * @param origin Base domain of host
 * @param tabOrigin The main origin for this tab
 */
function recordPrevalence(fqdn, origin, tabOrigin) {
  //
  var seen = JSON.parse(localStorage.getItem("seenThirdParties"));
  if (!(origin in seen)){
    seen[origin] = {};
  }
  seen[origin][tabOrigin] = true;
  localStorage.setItem("seenThirdParties", JSON.stringify(seen));
  // check to see if we've seen it on this first party, if not add a note for it

  // cause the options page to refresh
  FilterNotifier.triggerListeners("load");
  
  // Blocking based on outbound cookies
  var httpRequestPrevalence = Object.keys(seen[origin]).length;

  //block the origin if it has been seen on multiple first party domains
  if (httpRequestPrevalence >= prevalenceThreshold) {
    console.log('blacklisting origin', fqdn);
    blacklistOrigin(origin, fqdn);
  }
}

/**
 * Adds heuristicBlockingAccounting as listened to onBeforeSendHeaders request
 */
chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
  return heuristicBlockingAccounting(details);
}, {urls: ["<all_urls>"]}, ["requestHeaders", "blocking"]);

/**
 * Adds onResponseStarted listener. Monitor for cookies
 */
chrome.webRequest.onResponseStarted.addListener(function(details) {
  var hasSetCookie = false;
  for(var i = 0; i < details.responseHeaders.length; i++) {
    if(details.responseHeaders[i].name.toLowerCase() == "set-cookie") {
      hasSetCookie = true;
      break;
    }
  }
  if(hasSetCookie) {
    var origin = getBaseDomain(new URI(details.url).host);
    return heuristicBlockingAccounting(details);
  }
},
{urls: ["<all_urls>"]},
["responseHeaders"]);

