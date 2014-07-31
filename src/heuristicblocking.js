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
var matcherStore = require("matcher").matcherStore;
var Synchronizer = require("synchronizer").Synchronizer;
var BlockedDomainList = require("blockedDomainList").BlockedDomainList;
var Utils = require("utils").Utils;
var tabOrigins = { };
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

function addFiltersFromWhitelistToCookieblock(origin){
  var filters = matcherStore.combinedMatcherStore[whitelistName].whitelist.keywordByFilter
  for(filter in filters){
    var domain = getDomainFromFilter(filter)
    var baseDomain = getBaseDomain(domain);
    if(baseDomain == origin){
      setupCookieBlocking(baseDomain);
    }
  }
}

function getDomainFromFilter(filter){
  return filter.match('[|][|]([^\^]*)')[1]
}

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

        var heuristicSubscription = FilterStorage.knownSubscriptions["frequencyHeuristic"];
        // Create an ABP filter to block this origin 
        var filter = this.Filter.fromText("||" + origin + "^$third-party");
        filter.disabled = false;
        FilterStorage.addFilter(filter, heuristicSubscription);
      }
    });
  }  
};
// This maps cookie names to a rough estimate of how many bits of 
// identifying info we might be letting past by allowing them.
// (map values to lower case before using)
// We need something better than this eventually, informed by more real world data!
var lowEntropyCookieNames = {
  "acookie": 6,
  "cslist": 6,
  "conversion": 6,
  "coreid6": 6,
  "dexlifecycle": 6,
  "gaps": 6,
  "jeb2": 6,
  "jsessionid": 6,
  "livepersonid": 6,
  "muid": 6,
  "mintunique": 6,
  "oaid": 6,
  "oax": 6,
  "otz": 6,
  "ox_u": 6,
  "phpsessid": 6,
  "ssid": 6,
  "lsid": 6,
  "hsid": 6,
  "pref": 6,
  "prefid": 6,
  "ti": 6,
  "ti.si": 6,
  "wt_fpc": 6,
  "__ar_v4": 6,
  "__atuvc": 6,
  "__auc": 6,
  "__cfduid": 6,
  "__csmv": 6,
  "__csv": 6,
  "__gads": 6,
  "__k_iut": 6,
  "__qca": 6,
  "__srret": 6,
  "__sruid": 6,
  "__unam": 6,
  "__utma": 6,
  "__utmc": 6,
  "__utmv": 6,
  "__utmz": 6,
  "_cb_ls": 6,
  "_chartbeat2": 6,
  "_chartbeat_uuniq": 6,
  "_ga": 6,
  "_gauges_unique": 6,
  "_gauges_unique_year": 6,
  "_lsd0": 6,
  "_lsvc0": 6,
  "_mkto_trk": 6,
  "_polar_tu": 6,
  "azk": 6,
  "bb_lastactivity": 6,
  "bb_lastvisit": 6,
  "bucket_map": 6,
  "centralauth_loggedout": 6,
  "cid": 6,
  "crtg": 6,
  "csrftoken": 6,
  "dexoo": 6,
  "end_user_id": 6,
  "fly_edition": 6,
  "fly_geo": 6,
  "grvinsights": 6,
  "ki_t": 6,
  "ki_u": 6,
  "km_ai": 6,
  "km_lv": 6,
  "km_uq": 6,
  "lang": 6,
  "mbox": 6,
  "optimizelyBuckets": 6,
  "optimizelyEndUserId": 6,
  "optimizelySegments": 6,
  "parsely_uuid": 6,
  "prov": 6,
    "style_cookie": 6,
  "taboola_rii": 6,
  "taboola_svrii": 6,
  "taboola_svwv": 6,
  "taboola_uppc": 6,
  "taboola_wt": 6,
  "tuuid": 6,
  "uid": 6,
  "user_id": 6,
  "utag_main": 6,
  "uuid": 6,
  "uvts": 6,
  "v1st": 6,
  "wx_zip": 6,
  "opt-out":3,
  "optout":3,
  "opt_out":3,
  "dnt":3,
  "donottrack":3,
  "do-not-track":3,
  "js":3,
  "javascript":3,
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
  "a":4,
  "b":4,
  "c":4,
  "d":4,
  "e":4,
  "f":4,
  "g":4,
  "h":4,
  "i":4,
  "j":4,
  "k":4,
  "l":4,
  "m":4,
  "n":4,
  "o":4,
  "p":4,
  "q":4,
  "r":4,
  "s":4,
  "t":4,
  "u":4,
  "v":4,
  "w":4,
  "x":4,
  "y":4,
  "z":4,
}


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
var extractCookieString = function(details) {
  // @details are those from onBeforeSendHeaders
  // The RFC allows cookies to be separated by ; or , (!!@$#!) but chrome uses ;
  if(details.requestHeaders) {
    var headers = details.requestHeaders;
  } else if(details.responseHeaders) {
    var headers = details.responseHeaders;
  } else {
    console.log("A reqest was made with no headers! Crazy!");
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
}

const MAX_COOKIE_ENTROPY = 12;
var hasTracking = function(details, origin) {
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
    var lname = name.toLowerCase();
    var value = c.slice(cut+1);
    var lvalue = value.toLowerCase();
    if (!(lvalue in lowEntropyCookieValues) || !(lname in lowEntropyCookieNames)) {
      return true;
    }
    if(lvalue in lowEntropyCookieValues){
      estimatedEntropy += lowEntropyCookieValues[lvalue];
    }
    if(lname in lowEntropyCookieNames){
      estimatedEntropy += lowEntropyCookieNames[lname];
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

var heuristicBlockingAccounting = function(details) {
  // @details are those from onBeforeSendHeaders
  // Increment counts of how many first party domains we've seen a third party track on

  // Ignore requests that are outside a tabbed window
  if(details.tabId < 0){
    return { };
  }
  
  var fqdn = new URI(details.url).host
  var origin = getBaseDomain(fqdn);
  
  // Save the origin associated with the tab if this is a main window request
  if(details.type == "main_frame") {
    //console.log("Origin: " + origin + "\tURL: " + details.url);
    tabOrigins[details.tabId] = origin;
    return { };
  }
  else {
    var tabOrigin = tabOrigins[details.tabId];
    // Ignore first-party requests
    if (origin == tabOrigin)
      return { };
    // if there are no tracking cookies or similar things, ignore
    if (!hasTracking(details, origin)){
      return { };
    }
    // Record HTTP request prevalence
    if (!(origin in httpRequestOriginFrequency)){
      httpRequestOriginFrequency[origin] = { };
    }
    httpRequestOriginFrequency[origin][tabOrigin] = true; // This 3rd party tracked this 1st party
    // Blocking based on outbound cookies
    var httpRequestPrevalence = 0;
    if (origin in httpRequestOriginFrequency){
      httpRequestPrevalence = Object.keys(httpRequestOriginFrequency[origin]).length;
    }
  
    //block the origin if it has been seen on multiple first party domains
    if (httpRequestPrevalence >= prevalenceThreshold) {
      console.log('blacklisting origin', fqdn);
      blacklistOrigin(origin, fqdn);
    }
  }
};

chrome.webRequest.onBeforeRequest.addListener(function(details) {
  //heuristicBlockingAccounting(details); 
},
{urls: ["<all_urls>"]},
["blocking"]);




chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
  return heuristicBlockingAccounting(details);
}, {urls: ["<all_urls>"]}, ["requestHeaders", "blocking"]);

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

