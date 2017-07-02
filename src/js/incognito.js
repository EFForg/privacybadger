require.scopes.incognito = (function() {
var tabs = {};

// Get all existing tabs
chrome.tabs.query({}, function(results) {
  results.forEach(function(tab) {
    tabs[tab.id] = tab.incognito;
  });
});

// Tab event handlers
function onUpdatedHandler(tab) {
  tabs[tab.id] = tab.incognito;
}

function onRemovedHandler(tabId) {
  delete tabs[tabId];
}

function tabIsIncognito(tabId) {
  return tabs[tabId] || false;
}

/************************************** exports */
var exports = {};
exports.onRemoved = onRemovedHandler;
exports.onUpdated = onUpdatedHandler;
exports.tabIsIncognito = tabIsIncognito;

return exports;
/************************************** exports */
})();
