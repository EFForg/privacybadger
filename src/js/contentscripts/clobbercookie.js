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

document.__defineSetter__("cookie", function(/*value*/) { });
document.__defineGetter__("cookie", function() { return ""; });

// trim referrer down to origin
let referrer = document.referrer;
if (referrer) {
  referrer = referrer.slice(
    0,
    referrer.indexOf('/', referrer.indexOf('://') + 3)
  ) + '/';
}
document.__defineGetter__("referrer", function () { return referrer; });

}());
