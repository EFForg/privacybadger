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

function isIncognito(tab_id) {
  // if we don't have incognito data for whatever reason,
  // default to "true"
  if (!tabs.hasOwnProperty(tab_id)) {
    return true;
  }
  // else, do not learn in incognito tabs
  return tabs[tab_id];
}

function learningEnabled(tab_id) {
  if (badger.getSettings().getItem("learnInIncognito")) {
    // treat all pages as if they're not incognito
    return true;
  }

  // otherwise, return true if this tab is _not_ incognito
  return !isIncognito(tab_id);
}

/************************************** exports */
let exports = {
  learningEnabled,
  isIncognito,
  startListeners,
};
return exports;
/************************************** exports */
})();
