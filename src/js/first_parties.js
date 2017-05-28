/* globals log:false */
require.scopes.firstparties = (function() {

var firstPartyScripts = {
  "twitter.com": {
    "scriptName": "twitter.js",
    "vars": {
      "queryParam": "data-expanded-url"
    }
  },
  "tweetdeck.twitter.com": {
    "scriptName": "twitter.js",
    "vars": {
      "queryParam": "data-full-url"
    }
  }
};

function isRelevant(tabId, changeInfo, tab) {
  let config = firstPartyScripts[window.extractHostFromURL(tab.url)];
  if (!config) {
    return false;
  }
  if (changeInfo.status === "loading") {
    return true;
  }
  return false;
}

function injector(tabId, changeInfo, tab) {
  if (!isRelevant(tabId, changeInfo, tab)) {
    return;
  }
  // inject first party code
  let config = firstPartyScripts[window.extractHostFromURL(tab.url)];

  chrome.tabs.executeScript(tabId, {
    code: 'var config = ' + JSON.stringify(config.vars)
  }, function() {
    chrome.tabs.executeScript(tabId, {file: 'js/first_parties/' + config.scriptName});
  });
}

function startListeners() {
  chrome.tabs.onUpdated.addListener(injector);
}

var exports = {};
exports.startListeners = startListeners;
return exports;
})();
