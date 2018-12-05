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

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({ checkLocation: window.FRAME_URL }, function (blocked) {
  if (blocked) {
    // https://stackoverflow.com/questions/49092423/how-to-break-on-localstorage-changes
    var code =
      '('+ function() {

        try {
          localStorage; // eslint-disable-line no-unused-expressions
        } catch (ex) {
          // abort when we can't access localStorage
          // such as when "Block third-party cookies" is enabled in Chrome
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

        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          enumerable: true,
          value: lsProxy
        });

      } +')()';

    window.injectScript(code);
  }
  return true;
});

}());
