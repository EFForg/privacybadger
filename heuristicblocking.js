var backgroundPage = chrome.extension.getBackgroundPage();
var require = backgroundPage.require;

with(require("filterClasses"))
{
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
  this.SpecialSubscription = SpecialSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var matcherStore = require("matcher").matcherStore;
var Synchronizer = require("synchronizer").Synchronizer;
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
      if (xhr.status == 200)
        console.log("Successfully submitted params: " + params);
      else
        console.log("Error submitting params: " + params);
    }
  }
  xhr.send(params);
}

// this is missing parameters, and is not in use in the live extension
var sendTestingData = function() {
    var cookieSentPrevalence = 0;
    if (origin in cookieSentOriginFrequency)
      cookieSentPrevalence = Object.keys(cookieSentOriginFrequency[origin]).length;
    var cookieSetPrevalence = 0;
    if (origin in cookieSetOriginFrequency)
      cookieSetPrevalence = Object.keys(cookieSetOriginFrequency[origin]).length;
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
  if (httpRequestPrevalence < testThreshold)
    return false;
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

var blacklistOrigin = function(origin) {
  // Heuristic subscription
  if (!("frequencyHeuristic" in FilterStorage.knownSubscriptions)) {
    console.log("Error. Could not blacklist origin because no heuristic subscription found");
    return;
  }
  var heuristicSubscription = FilterStorage.knownSubscriptions["frequencyHeuristic"];
  // Create an ABP filter to block this origin 
  var filter = this.Filter.fromText("||" + origin + "^$third-party");
  filter.disabled = false;
  if (!testing) {
    console.log("Adding filter for " + heuristicSubscription.url);
    FilterStorage.addFilter(filter, heuristicSubscription);
  }
  // Vanilla ABP does this step too, not clear if there's any privacy win
  // though:

  //if (nodes)
  //  Policy.refilterNodes(nodes, item);
  return true;
};

// We need something better than this eventually!
// map to lower case before using
var lowEntropyCookieValues = {
 "":true,
 "nodata":true,
 "no_data":true,
 "yes":true,
 "no":true,
 "true":true,
 "false":true,
 "opt-out":true,
 "optout":true,
 "opt_out":true,
 "0":true,
 "1":true,
 "2":true,
 "3":true,
 "4":true,
 "5":true,
 "6":true,
 "7":true,
 "8":true,
 "9":true
};

var extractCookieString = function(details) {
  // @details are those from onBeforeSendHeaders
  // The RFC allows cookies to be separated by ; or , (!!@$#!) but chrome uses ;
  if (!details.requestHeaders) {
    console.log("Expect the unexpected!");
    console.log(details);
    return true;
  }
  var cookies = "";
  for (var n = 0; n < details.requestHeaders.length; n++) {
    var h = details.requestHeaders[n];
    if (h.name == "Cookie") {
      if (!cookies) {
        cookies = h.value;
      } else {
        // Should not happen?  Except perhaps due to crazy extensions?
        console.log("MULTIPLE COOKIE HEADERS!!!");
        cookies = cookies + ";" + h.value;
      }
    }
  }
  return cookies;
}

var hasTracking = function(details, origin) {
  // @details are those from onBeforeSendHeaders

  var cookies = extractCookieString(details);
  if (!cookies) {
    //console.log("No cookies in ");
    //console.log(details);
    return false;
  }
  cookies = cookies.split(";");
  var hasCookies = false;
  for (var n = 0; n < cookies.length; n++) {
    // XXX urgh I can't believe we're parsing cookies.  Probably wrong
    // what if the value has spaces in it?
    hasCookies = true;
    var c = cookies[n].trim();
    var cut = c.indexOf("=");
    var name = c.slice(0,cut - 1);
    var value = c.slice(cut+1);
    if (!(value.toLowerCase() in lowEntropyCookieValues)) {
      return true;
    }
  }
  if (hasCookies) {
     console.log("All cookies for " + origin + " deemed low entropy...");
     for (var n = 0; n < cookies.length; n++) {
        console.log("    " + cookies[n]);
     }
  }
  return false;
};

var heuristicBlockingAccounting = function(details) {
  // @details are those from onBeforeSendHeaders
  // Increment counts of how many first party domains we've seen a third party track on

  // Ignore requests that are outside a tabbed window
  if(details.tabId < 0)
    return { };
  
  var origin = getBaseDomain(new URI(details.url).host);
  
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
    if (!hasTracking(details, origin))
      return { };
    // Record HTTP request prevalence
    if (!(origin in httpRequestOriginFrequency))
      httpRequestOriginFrequency[origin] = { };
    httpRequestOriginFrequency[origin][tabOrigin] = true; // This 3rd party tracked this 1st party
    // Blocking based on outbound cookies
    var httpRequestPrevalence = 0;
    if (origin in httpRequestOriginFrequency)
      httpRequestPrevalence = Object.keys(httpRequestOriginFrequency[origin]).length;

    if (testing && needToSendOrigin(origin, httpRequestPrevalence)) {
      // Not enabled in the live extension.  Would require extra parameters here.
      // sendTestingData()
    } else {
      if (httpRequestPrevalence >= prevalenceThreshold) {
        console.log("Adding " + origin + " to heuristic blocklist.");
        blacklistOrigin(origin);
      }
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
    if(details.responseHeaders[i].name == "Set-Cookie") {
      hasSetCookie = true;
      break;
    }
  }
  if(hasSetCookie) {
    var origin = getBaseDomain(new URI(details.url).host);
    var tabOrigin = tabOrigins[details.tabId];
    if (origin != tabOrigin) {
      if(!(origin in cookieSetOriginFrequency))
        cookieSetOriginFrequency[origin] = { };
      cookieSetOriginFrequency[origin][tabOrigin] = true;
    }
  }
},
{urls: ["<all_urls>"]},
["responseHeaders"]);
