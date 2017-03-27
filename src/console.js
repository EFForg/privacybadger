/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2015 Electronic Frontier Foundation
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

function logMessages () {
  var pastLogs = [];
  return function (message) {
    if (message.logs && message.type && message.type === 'LOGS') {
      message.logs.forEach(function (log) {
        if (pastLogs.indexOf(log) === -1) {
          pastLogs.push(log);
          console.log(log);
        }
      });
    }
  };
}

chrome.runtime.onMessage.addListener(logMessages());
