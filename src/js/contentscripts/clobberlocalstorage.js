/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

/**
 * Runs in page content context. Injects a script that deletes cookies.
 * Communicates to webrequest.js to get orders if to delete cookies.
 */

/**
 * Insert script into page
 *
 * @param {String} text The script to insert into the page
 */

function insertClsScript(text) {
  var parent = document.documentElement,
    script = document.createElement('script');

  script.text = text;
  script.async = false;

  parent.insertBefore(script, parent.firstChild);
  parent.removeChild(script);
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({checkLocation:document.location.href}, function(blocked) {
  if (blocked) {
    var code =
      '('+ function() {
        try {
          window.localStorage.getItem = function() {
            return {};
          };
          window.localStorage.setItem = function(/*newValue*/) {
            //doNothing
          };
        } catch (ex) {
          // ignore exceptions thrown when "Block third-party cookies" is enabled in Chrome
        }
      } +')()';

    insertClsScript(code);
  }
  return true;
});
