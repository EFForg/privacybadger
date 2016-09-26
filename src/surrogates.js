/*
 *
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2016 Electronic Frontier Foundation
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

require.scopes.surrogates = (function() {

const db = require('surrogatedb');

// gets called within request-blocking listeners
// needs to be fast!
function getSurrogateURI(script_url, script_hostname) {
  // do we have an entry for the script hostname?
  if (db.hostnames.hasOwnProperty(script_hostname)) {
    const hosts = db.hostnames[script_hostname];

    // do any of the pattern tokens for that hostname match the script URL?
    for (let i = 0; i < hosts.length; i++) {
      const token = hosts[i],
        qs_start = script_url.indexOf('?');

      let match = false;

      if (qs_start == -1) {
        if (script_url.endsWith(token)) {
          match = true;
        }
      } else {
        if (script_url.endsWith(token, qs_start)) {
          match = true;
        }
      }

      if (match) {
        // there is a match, return the surrogate code
        return 'data:application/javascript;base64,' + btoa(db.surrogates[token]);
      }
    }
  }

  return false;
}

const exports = {
  getSurrogateURI: getSurrogateURI,
};

return exports;
})();
