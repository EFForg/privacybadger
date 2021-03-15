/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2014 Electronic Frontier Foundation
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Temporary polyfill for firefox android,
 * while it doesn't support the full browserAction API
 * Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1330159
 */

require.scopes.firefoxandroid = (function() {
var hasPopupSupport = !!(
  chrome.browserAction.setPopup &&
  chrome.browserAction.getPopup
);
var hasBadgeSupport = !!chrome.browserAction.setBadgeText;

// keeps track of popup id while one is open
var openPopupId = false;
var popup_url = chrome.runtime.getManifest().browser_action.default_popup;

// fakes a popup
function openPopup() {
  chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
    var url = popup_url + "?tabId=" + tabs[0].id;
    chrome.tabs.create({url, index: tabs[0].index + 1}, (tab) => {
      openPopupId = tab.id;
    });
  });
}

// remove the 'popup' when another tab is activated
function onActivated(activeInfo) {
  if (openPopupId != false && openPopupId != activeInfo.tabId) {
    chrome.tabs.remove(openPopupId, () => {
      openPopupId = false;
    });
  }
}

// forgets the popup when the url is overwritten by the user
function onUpdated(tabId, changeInfo, tab) {
  if (tab.url && openPopupId == tabId) {
    var new_url = new URL(tab.url);

    if (new_url.origin + new_url.pathname != popup_url) {
      openPopupId = false;
    }
  }
}

// Subscribe to events needed to fake a popup
function startListeners() {
  if (!hasPopupSupport) {
    chrome.browserAction.onClicked.addListener(openPopup);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
  }
}

// Used in popup.js, figures out which tab opened the 'fake' popup
function getParentOfPopup(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, function(focusedTab) {
    var parentId = parseInt(new URL(focusedTab[0].url).searchParams.get('tabId'));
    chrome.tabs.get(parentId, callback);
  });
}

/************************************** exports */
var exports = {};
exports.startListeners = startListeners;
exports.hasPopupSupport = hasPopupSupport;
exports.hasBadgeSupport = hasBadgeSupport;
exports.getParentOfPopup = getParentOfPopup;
return exports;
/************************************** exports */
})();
