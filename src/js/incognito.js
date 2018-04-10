/* globals badger:false */

require.scopes.incognito = (function() {
var tabs = {};

// Get all existing tabs
chrome.tabs.query({}, function(results) {
  results.forEach(function(tab) {
    tabs[tab.id] = tab.incognito;
  });
});

// Create tab event listeners
function onUpdatedListener(tabId, changeInfo, tab) {
  tabs[tab.id] = tab.incognito;
}

function onRemovedListener(tabId) {
  delete tabs[tabId];
}

// Subscribe to tab events
function startListeners() {
  chrome.tabs.onUpdated.addListener(onUpdatedListener);
  chrome.tabs.onRemoved.addListener(onRemovedListener);
}

function tabIsIncognito(tabId) {
  return tabs[tabId] || false;
}

function learningEnabled(tabId) {
  if (badger.isLearnInIncognitoEnabled()) {
    // Treat all pages as if they're not incognito
    return true;
  }
  // Else, do not learn in incognito tabs
  return !tabIsIncognito(tabId);
}

/************************************** exports */
let exports = {
  learningEnabled,
  startListeners,
  tabIsIncognito,
};
return exports;
/************************************** exports */
})();
