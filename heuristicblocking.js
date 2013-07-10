var tabOrigins = { };

var originFrequency = { };

var prevalenceThreshold = 3;

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
    if (origin == tabOrigin)
      return { };
    else if(!(origin in originFrequency))
      return { };
    else {
      if(Object.keys(originFrequency[origin]).length >= prevalenceThreshold) {
        console.log("Blocked " + origin + " because it appeared with cookies on: " + Object.keys(originFrequency[origin]));
        return { cancel: true };
      }
      return { };
    }
  }
},
{urls: ["<all_urls>"]},
["blocking"]);

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
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
      if(!(origin in originFrequency))
        originFrequency[origin] = { };
      originFrequency[origin][tabOrigin] = true;
    }
  }
  
  return { };
},
{urls: ["<all_urls>"]},
["requestHeaders"]);
