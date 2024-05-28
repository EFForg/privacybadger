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

// NOTE: code below is not a content script: no chrome.* APIs

(function () {

// If localStorage is inaccessible, such as when "Block third-party cookies"
// in enabled in Chrome or when `dom.storage.enabled` is set to `false` in
// Firefox, do not go any further.
try {
  // No localStorage raises an Exception in Chromium-based browsers, while
  // it's equal to `null` in Firefox.
  if (null === localStorage) {
    throw false;
  }
} catch (ex) {
  return;
}

let lsProxy = new Proxy(localStorage, {
  set: function (/*ls, prop, value*/) {
    return true;
  },
  get: function (ls, prop) {
    if (typeof ls[prop] == 'function') {
      let fn = function () {};
      if (prop == 'getItem' || prop == 'key') {
        fn = function () { return null; };
      }
      return fn.bind(ls);
    } else {
      if (prop == 'length') {
        return 0;
      } else if (prop == '__proto__') {
        return lsProxy;
      }
      return;
    }
  }
});

// https://stackoverflow.com/questions/49092423/how-to-break-on-localstorage-changes
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  enumerable: true,
  value: lsProxy
});

}());
