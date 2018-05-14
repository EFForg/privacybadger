/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

function getPageScript() {

  // code below is not a content script: no chrome.* APIs /////////////////////

  // return a string
  return "(" + function (NAVIGATOR, OBJECT) {

    OBJECT.defineProperty(OBJECT.getPrototypeOf(NAVIGATOR), "doNotTrack", {
      get: () => {
        return "1";
      }
    });

  // save locally to keep from getting overwritten by site code
  } + "(window.navigator, Object));";

  // code above is not a content script: no chrome.* APIs /////////////////////

}

/**
 * Executes a script in the page DOM context
 */
function insertPageScript(text) {
  var parent = document.documentElement,
    script = document.createElement('script');

  script.text = text;
  script.async = false;

  parent.insertBefore(script, parent.firstChild);
  parent.removeChild(script);
}

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

(function () {

// don't inject into non-HTML documents (such as XML documents)
// but do inject into XHTML documents
if (document instanceof HTMLDocument === false && (
  document instanceof XMLDocument === false ||
  document.createElement('div') instanceof HTMLDivElement === false
)) {
  return;
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  checkEnabled: true
}, function (enabled) {
  if (enabled) {
    insertPageScript(getPageScript());
  }
});

}());
