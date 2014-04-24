/*
 * This file is part of Privacy Badger <https://eff.org/privacybadger>
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

// Clobber cookies, using a function closure to keep the dummy private
var code = 
  'var dummyCookie = "x=y";' +
  'document.__defineSetter__("cookie", function(value) { alert("in setter"); return dummyCookie; });' +
  'document.__defineGetter__("cookie", function() { alert("in getter"); return dummyCookie; });';

var script = document.createElement('script');
script.appendChild(document.createTextNode(code));
(document.head || document.documentElement).appendChild(script);
script.parentNode.removeChild(script);
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
