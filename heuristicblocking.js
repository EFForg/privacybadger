with(require("filterClasses"))
{
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
var FilterStorage = require("filterStorage").FilterStorage;
var tabOrigins = { };
var originFrequency = { };

var prevalenceThreshold = 3;

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


chrome.webRequest.onBeforeRequest.addListener(function(details) {
  // Ignore requests that are outside a tabbed window
  if(details.tabId < 0)
    return { };
  
  var origin = getBaseDomain(new URI(details.url).host);
  
  // Save the origin associated with the tab if this is a main window request
  if(details.type == "main_frame") {
    console.log("Origin: " + origin + "\tURL: " + details.url);
    tabOrigins[details.tabId] = origin;
    return { };
  }
  else {
    var tabOrigin = tabOrigins[details.tabId];
    if (origin == tabOrigin)
      return { };
    else {
      if(!(origin in originFrequency))
        originFrequency[origin] = { };
      originFrequency[origin][tabOrigin] = true;
      var l = Object.keys(originFrequency[origin]).length;
      if( l == prevalenceThreshold) {
        console.log("Blocking " + origin + " because it appeared on: " + Object.keys(originFrequency[origin]));
        blacklistOrigin(origin);
      }
      return { };
    }
  }
},
{urls: ["<all_urls>"]},
["blocking"]);
