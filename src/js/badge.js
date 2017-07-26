/* globals badger:false */
/*
 * Run the little badger badge next to the url bar
 */

require.scopes.badge = (function() {

let disabled_sizes = [19, 38];
let enabled_sizes = [16, 19, 38, 48, 64, 128];

function getIcons(enabled) {
  let out = {};
  let sizes = (enabled ? enabled_sizes : disabled_sizes);
  sizes.forEach((size) => {
    let filename = 'icons/badger-' + size + (enabled ? '' : '-disabled') + '.png';
    out[size] =  chrome.runtime.getURL(filename);
  });
  return out;
}

let enabled_icons = getIcons(true);
let disabled_icons = getIcons(false);

function refresh(tab) {
  let icons = badger.isPrivacyBadgerEnabled(window.extractHostFromURL(tab.url)) ? enabled_icons : disabled_icons;
  chrome.browserAction.setIcon({tabId: tab.id, path: icons});
  chrome.browserAction.setTitle({tabId: tab.id, title: "Privacy Badger"});
}

function initializeAndStartListeners() {
  /* put a badge on every tab */
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      refresh(tab);
    });
  });
  /* start listeners */
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      refresh(tab);
    }
  });
  chrome.tabs.onReplaced.addListener((addedTabId/*, removedTabId */) => {
    chrome.tabs.get(addedTabId, function(tab){
      refresh(tab);
    });
  });
}

var exports = {};
exports.initializeAndStartListeners = initializeAndStartListeners;
return exports;
})();
