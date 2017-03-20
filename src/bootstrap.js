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

window.DEBUG = false;
window.badger = {};

/**
* Log a message to the console if debugging is enabled
*/
window.log = function (/*...*/) {
  if(window.DEBUG) {
    console.log.apply(console, arguments);
  }
};

/**
 * Log a message to the console of an active tab
 */
window.logToTab = logToTabConstructor();
function logToTabConstructor() {
  var tabs = {};
  var _logToTab = debounce(function (tab_id) {
    setTimeout(function () {
      chrome.tabs.sendMessage(tab_id, { type: 'LOGS', logs: tabs[tab_id] });
      delete tabs[tab_id];
    }, 0);
  }, 1000);
  return function (tab_id, text) {
    if (!tabs[tab_id]) {
      tabs[tab_id] = [];
    }
    if (tabs[tab_id].indexOf(text) === -1) {
      tabs[tab_id].push(text);
      _logToTab(tab_id);
    }
  };
}

/**
 * Basic implementation of requirejs
 * for requiring other javascript files
 */
function require(module) {
  return require.scopes[module];
}
require.scopes = {};

// from Underscore v1.6.0
function debounce(func, wait, immediate) {
  var timeout, args, context, timestamp, result;

  var later = function () {
    var last = Date.now() - timestamp;
    if (last < wait) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  };
  return function () {
    context = this;
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };
}
