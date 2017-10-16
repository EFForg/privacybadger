/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

/**
 * Insert script into page
 *
 * @param {String} text The script to insert into the page
 * @param {Object} data a dictionary containing attribut-value pairs
 */
function insertScScript(text, data) {
  var parent = document.documentElement,
    script = document.createElement('script');

  script.text = text;
  script.async = false;

  for (var key in data) {
    script.setAttribute('data-' + key.replace(/_/g, "-"), data[key]);
  }

  parent.insertBefore(script, parent.firstChild);
  parent.removeChild(script);
}


/**
 * Generate script to inject into the page
 *
 * @returns {string}
 */
function getScPageScript() {
  // code below is not a content script: no chrome.* APIs /////////////////////

  // return a string
  return "(" + function () {

    var event_id = document.currentScript.getAttribute('data-event-id-super-cookie');

    /**
     * send message to the content script
     *
     * @param message
     */
    var send = function (message) {
      document.dispatchEvent(new CustomEvent(event_id, {
        detail: message
      }));
    };

    /**
     * Read the local storage and returns content
     * @returns {{}}
     */
    var getLocalStorageItems = function() {
      var lsItems = {};
      var lsKey = "";
      try {
        for (var i = 0; i < localStorage.length; i++) {
          lsKey = localStorage.key(i);
          lsItems[lsKey] = localStorage.getItem(lsKey);
        }
      } catch (err) {
        // We get a SecurityError when our injected script runs in a 3rd party frame and
        // the user has disabled 3rd party cookies and site data. See, http://git.io/vLwff
        return {};
      }
      return lsItems;
    };

    var getIndexedDBItems = function() {
      return {};
    };

    var getFileSystemAPIItems = function() {
      // TODO: See "Reading a directory's contents" on
      // http://www.html5rocks.com/en/tutorials/file/filesystem/
      return {};
    };

    if (event_id) { // inserted script may run before the event_id is available
      // send to content script. TODO: Any other detail we need to send?
      send(
        { docUrl: document.location.href,
          localStorageItems: getLocalStorageItems(),
          indexedDBItems: getIndexedDBItems(),
          fileSystemAPIItems: getFileSystemAPIItems()
        });
    }

  } + "());";

  // code above is not a content script: no chrome.* APIs /////////////////////

}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  checkEnabledAndThirdParty: true
}, function (enabledAndThirdParty) {
  if (!enabledAndThirdParty) {
    return;
  }

  var event_id_super_cookie = Math.random();

  // listen for messages from the script we are about to insert
  document.addEventListener(event_id_super_cookie, function (e) {
    // pass these on to the background page (handled by webrequest.js)
    chrome.runtime.sendMessage({
      'superCookieReport': e.detail
    });
  });

  // console.log("Will search for supercookies at", document.location.href)
  insertScScript(getScPageScript(), {
    event_id_super_cookie: event_id_super_cookie
  });

});
