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

function dontLearnInTab(tabId) {
  if (badger.isLearnInIncognitoEnabled()) {
    // Treat all pages as if they're not incognito
    return false;
  }
  return tabs[tabId] || false;
}

/************************************** exports */
var exports = {};
exports.startListeners = startListeners;
exports.dontLearnInTab = dontLearnInTab;

return exports;
/************************************** exports */
})();
