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

var db = require('surrogatedb').db;

// gets called within request-blocking listeners
// needs to be fast!
function getSurrogateURI(script_url) {
  if (db.hasOwnProperty(script_url)) {
    // there is a match
    return 'data:application/javascript;base64,' + btoa(db[script_url]);
  }

  return false;
}

var exports = {};
exports.getSurrogateURI = getSurrogateURI;

return exports;
})();
