/*with(require("filterClasses"))
{
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
var FilterStorage = require("filterStorage").FilterStorage;*/
var tabOrigins = { };
var cookieSentOriginFrequency = { };
var cookieSetOriginFrequency = { };
var httpRequestOriginFrequency = { };

var prevalenceThreshold = 3;

/*
var blacklistOrigin = function(origin) {
  // Create an ABP filter to block this origin that seems to be engaging in
  // non-consensual tracking
  var filter = this.Filter.fromText("||" + origin + "^$third-party");
  filter.disabled = false;
  this.FilterStorage.addFilter(filter);

  // Vanilla ABP does this step too, not clear if there's any privacy win
  // though:

  //if (nodes)
  //  Policy.refilterNodes(nodes, item);

  return true;
};
*/

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
    if(!(origin in httpRequestOriginFrequency))
      httpRequestOriginFrequency[origin] = { };
    httpRequestOriginFrequency[origin][tabOrigin] = true;
    // Blocking based on outbound cookies
    var httpRequestPrevalence = 0;
    if(origin in httpRequestOriginFrequency)
      httpRequestPrevalence = Object.keys(httpRequestOriginFrequency[origin]).length;
    var cookieSentPrevalence = 0;
    if(origin in cookieSentOriginFrequency)
      cookieSentPrevalence = Object.keys(cookieSentOriginFrequency[origin]).length;
    var cookieSetPrevalence = 0;
    if(origin in cookieSetOriginFrequency)
      cookieSetPrevalence = Object.keys(cookieSetOriginFrequency[origin]).length;
    console.log("Request to " + origin + ", seen on " + httpRequestPrevalence + " third-party origins, sent cookies on " + cookieSentPrevalence + ", set cookies on " + cookieSetPrevalence);
    //if( cookieSentPrevalence == prevalenceThreshold) {
      //console.log("Blocking " + origin + " because it appeared with cookies on: " + Object.keys(cookieSentOriginFrequency[origin]));
      //blacklistOrigin(origin);
      //return { cancel: true };
    //}
  }
},
{urls: ["<all_urls>"]},
["blocking"]);

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
  // Add DNT: 1 to outbound requests
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
  
  return { requestHeaders: details.requestHeaders };
},
{urls: ["<all_urls>"]},
["requestHeaders", "blocking"]);

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
