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

function tabIsIncognito(tabId) {
  return tabs[tabId] || false;
}

/************************************** exports */
var exports = {};
exports.onRemoved = onRemovedListener;
exports.onUpdated = onUpdatedListener;
exports.tabIsIncognito = tabIsIncognito;

return exports;
/************************************** exports */
})();
