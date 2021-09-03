/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2015 Electronic Frontier Foundation
 *
 * Derived from Chameleon <https://github.com/ghostwords/chameleon>
 * Copyright (C) 2015 ghostwords
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

(function () {

// don't inject into non-HTML documents (such as XML documents)
// but do inject into XHTML documents
if (document instanceof HTMLDocument === false && (
  document instanceof XMLDocument === false ||
  document.createElement('div') instanceof HTMLDivElement === false
)) {
  return;
}

// don't bother asking to run when trivially in first-party context
if (window.top == window) {
  return;
}

/**
 * Generate script to inject into the page
 *
 * @returns {string}
 */
function getPageScript(event_id) {
  // code below is not a content script: no chrome.* APIs /////////////////////

  // return a string
  return "(" + function (EVENT_ID) {

    /*
     * If localStorage is inaccessible, such as when "Block third-party cookies"
     * in enabled in Chrome or when `dom.storage.enabled` is set to `false` in
     * Firefox, do not go any further.
     */
    try {
      // No localStorage raises an Exception in Chromium-based browsers, while
      // it's equal to `null` in Firefox.
      if (null === localStorage) {
        throw false;
      }
    } catch (ex) {
      return;
    }

    (function (DOCUMENT, dispatchEvent, CUSTOM_EVENT, LOCAL_STORAGE, OBJECT, keys) {

      function send(message) {
        dispatchEvent.call(DOCUMENT, new CUSTOM_EVENT(EVENT_ID, {
          detail: message
        }));
      }

      /**
       * Read HTML5 local storage and return contents
       * @returns {Object}
       */
      function getLocalStorageItems() {
        let lsItems = {};
        for (let i = 0; i < LOCAL_STORAGE.length; i++) {
          let key = LOCAL_STORAGE.key(i);
          lsItems[key] = LOCAL_STORAGE.getItem(key);
        }
        return lsItems;
      }

      let localStorageItems = getLocalStorageItems();
      if (keys.call(OBJECT, localStorageItems).length) {
        send({ localStorageItems });
      }

    // save locally to keep from getting overwritten by site code
    } (document, document.dispatchEvent, CustomEvent, localStorage, Object, Object.keys));

  } + "(" + event_id + "));";

  // code above is not a content script: no chrome.* APIs /////////////////////

}

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

// TODO race condition; fix waiting on https://crbug.com/478183

// TODO here we could also be injected too quickly
// and miss localStorage setting upon initial page load
//
// we should eventually switch injection back to document_start
// (reverting https://github.com/EFForg/privacybadger/pull/1522),
// and fix localstorage detection
// (such as by delaying it or peforming it periodically)
//
// could then remove test workarounds like
// https://github.com/EFForg/privacybadger/commit/39d5d0899e22d1c451d429e44553c5f9cad7fc46

// TODO sometimes contentscripts/utils.js isn't here?!
// TODO window.FRAME_URL / window.injectScript are undefined ...
chrome.runtime.sendMessage({
  type: "inspectLocalStorage",
  frameUrl: window.FRAME_URL
}, function (enabledAndThirdParty) {
  if (!enabledAndThirdParty) {
    return;
  }

  const event_id = Math.random();

  // listen for messages from the script we are about to insert
  document.addEventListener(event_id, function (e) {
    // pass these on to the background page (handled by webrequest.js)
    chrome.runtime.sendMessage({
      type: "supercookieReport",
      data: e.detail,
      frameUrl: window.FRAME_URL
    });
  });

  window.injectScript(getPageScript(event_id));

});

}());
