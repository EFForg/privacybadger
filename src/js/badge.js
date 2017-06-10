/* globals badger:false */
/*
 * Run the little badger badge next to the url bar
 */

require.scopes.badge = (function() {

let sizes = [16, 19, 24, 32, 38, 48, 64, 128, 170];
function getIcons(enabled) {
  let out = {};
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

function initialize() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      refresh(tab);
    });
  });
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
exports.initialize = initialize;
return exports;
})();
