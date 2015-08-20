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
chrome.runtime.sendMessage({checkLocation:document.location}, function(blocked) {
  if (blocked) {
    var code =
      'var dummyCookie = "x=y";' +
      'document.__defineSetter__("cookie", function(value) { return dummyCookie; });' +
      'document.__defineGetter__("cookie", function() { return dummyCookie; });';

    var script = document.createElement('script');

    script.appendChild(document.createTextNode(code));
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);

    for (var prop in script) { delete script[prop]; }
  }

  return true;
});
// Clobber local storage, using a function closure to keep the dummy private
/*(function() {
  var dummyLocalStorage = { };
  Object.defineProperty(window, "localStorage", {
    __proto__: null,
    configurable: false,
    get: function () {
      return dummyLocalStorage;
    },
    set: function (newValue) {
      // Do nothing
    }
  });
})(); */
