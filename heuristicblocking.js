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
}
var whitelistUrl = "https://www.eff.org/files/sample_whitelist.txt";
try {
  var subscription = Subscription.fromURL(whitelistUrl);
  if (subscription && !(subscription.url in FilterStorage.knownSubscriptions))
  {
    subscription.title = "EFF Auto Whitelist";
    FilterStorage.addSubscription(subscription);
    Synchronizer.execute(subscription, false, false, true);
  }
} catch (e) {
  console.log("Could not add whitelist!");
}

var FilterStorage = require("filterStorage").FilterStorage;
var tabOrigins = { };
var cookieSentOriginFrequency = { };
var cookieSetOriginFrequency = { };
var httpRequestOriginFrequency = { };
var prevalenceThreshold = 3;

// variables for alpha test extension
var lastSentXhr = { };
var testing = true;
var testThreshold = 3;
var numMinutesToWait = 360;


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
  // Create an ABP filter to block this origin that seems to be engaging in
  // non-consensual tracking
  var filter = this.Filter.fromText("||" + origin + "^$third-party");
  filter.disabled = false;
  if (!testing)
    this.FilterStorage.addFilter(filter);

  // Vanilla ABP does this step too, not clear if there's any privacy win
  // though:

  //if (nodes)
  //  Policy.refilterNodes(nodes, item);

  return true;
};

chrome.webRequest.onBeforeRequest.addListener(function(details) {
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
    // Record HTTP request prevalence
    if (!(origin in httpRequestOriginFrequency))
      httpRequestOriginFrequency[origin] = { };
    httpRequestOriginFrequency[origin][tabOrigin] = true;
    // Blocking based on outbound cookies
    var httpRequestPrevalence = 0;
    if (origin in httpRequestOriginFrequency)
      httpRequestPrevalence = Object.keys(httpRequestOriginFrequency[origin]).length;
    var cookieSentPrevalence = 0;
    if (origin in cookieSentOriginFrequency)
      cookieSentPrevalence = Object.keys(cookieSentOriginFrequency[origin]).length;
    var cookieSetPrevalence = 0;
    if (origin in cookieSetOriginFrequency)
      cookieSetPrevalence = Object.keys(cookieSetOriginFrequency[origin]).length;
    if (testing && needToSendOrigin(origin, httpRequestPrevalence)) {
      var reqParams = []
      reqParams.push("origin="+origin);
      reqParams.push("thirdpartynum="+httpRequestPrevalence);
      reqParams.push("cookiesentnum="+cookieSentPrevalence);
      reqParams.push("cookiereceivednum="+cookieSetPrevalence);
      var params = reqParams.join("&");
      sendXHR(params);
      console.log("Request to " + origin + ", seen on " + httpRequestPrevalence + " third-party origins, sent cookies on " + cookieSentPrevalence + ", set cookies on " + cookieSetPrevalence);
    }
    // todo: logic to actually block based on prevalence/cookie thresholds
  //  else {
  //   var tabOrigin = tabOrigins[details.tabId];
  //   if (origin == tabOrigin)
  //     return { };
  //   else if(!(origin in originFrequency))
  //     return { };
  //   else {
  //     var l = Object.keys(originFrequency[origin]).length;
  //     if( l == prevalenceThreshold) {
  //       console.log("Blocking " + origin + " because it appeared with cookies on: " + Object.keys(originFrequency[origin]));
  //       blacklistOrigin(origin);
  //     }
  //   }
  // }
  }
},
{urls: ["<all_urls>"]},
["blocking"]);

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
  // make sure to set DNT:1
  details.requestHeaders.push({name: "DNT", value: "1"});
  // Ignore requests that are outside a tabbed window
  if(details.tabId < 0)
    return { };
  // Log the visit if a cookie was sent
  var hasCookie = false;
  for(var i = 0; i < details.requestHeaders.length; i++) {
    if(details.requestHeaders[i].name == "Cookie") {
      hasCookie = true;
      break;
    }
  }
  if(hasCookie) {
    var origin = getBaseDomain(new URI(details.url).host);
    var tabOrigin = tabOrigins[details.tabId];
    if (origin != tabOrigin) {
      if(!(origin in cookieSentOriginFrequency))
        cookieSentOriginFrequency[origin] = { };
      cookieSentOriginFrequency[origin][tabOrigin] = true;
    }
  }
  return {requestHeaders: details.requestHeaders};
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
