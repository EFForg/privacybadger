require.scopes.incognito = (function() {
var tabs = {};

// Get all existing tabs
chrome.tabs.query({}, function(results) {
  results.forEach(function(tab) {
    tabs[tab.id] = tab.incognito;
  });
});

// Tab event handlers
function onUpdated(tab) {
  tabs[tab.id] = tab.incognito;
}

function onRemoved(tabId) {
  delete tabs[tabId];
}

function tabIsIncognito(tabId) {
  return tabs[tabId] || false;
}

/************************************** exports */
var exports = {};
exports.onRemoved = onRemoved;
exports.onUpdated = onUpdated;
exports.tabIsIncognito = tabIsIncognito;

return exports;
/************************************** exports */
})();
