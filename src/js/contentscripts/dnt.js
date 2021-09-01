/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2018 Electronic Frontier Foundation
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

function getPageScript() {

  // code below is not a content script: no chrome.* APIs /////////////////////

  // return a string
  return "(" + function (NAVIGATOR, OBJECT) {

    if (NAVIGATOR.doNotTrack != "1") {
      OBJECT.defineProperty(OBJECT.getPrototypeOf(NAVIGATOR), "doNotTrack", {
        get: function doNotTrack() {
          return "1";
        }
      });
    }

    if (!NAVIGATOR.globalPrivacyControl) {
      try {
        OBJECT.defineProperty(NAVIGATOR, "globalPrivacyControl", {
          value: true
        });
      } catch (e) {
        console.error("Privacy Badger failed to set navigator.globalPrivacyControl, probably because another extension set it in an incompatible way first.");
      }
    }

  // save locally to keep from getting overwritten by site code
  } + "(window.navigator, Object));";

  // code above is not a content script: no chrome.* APIs /////////////////////

}

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  type: "checkDNT"
}, function (enabled) {
  if (enabled) {
    window.injectScript(getPageScript());
  }
});

}());
