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

blacklistOrigin = function(origin) {
  let filter = this.Filter.fromText("||" + origin + "^$third-party");
  filter.disabled = false;
  this.FilterStorage.addFilter(filter);
  console.log("Nothing exploded while blacklisting " + origin);

  //if (nodes)
  //  Policy.refilterNodes(nodes, item);

  return true;
}


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
      let l = Object.keys(originFrequency[origin]).length;
      if( l >= prevalenceThreshold) {
        console.log("Blocked " + origin + " because it appeared on: " + Object.keys(originFrequency[origin]));
        if (l ==prevalenceThreshold) {
          console.log("Step 1");
          blacklistOrigin(origin);
          console.log("Step 2");
        }

        return { cancel: true };
      }
      return { };
    }
  }
},
{urls: ["<all_urls>"]},
["blocking"]);
