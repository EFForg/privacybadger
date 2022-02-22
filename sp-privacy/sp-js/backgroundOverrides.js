/*
 * Copyright (C) 2021 Surfboard Holding B.V. <https://www.startpage.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/*
This file provides overrides to https://github.com/Openmail/privacybadger/blob/master/src/js/background.js
*/

// Disable privacy badger icon updates
window.badger.updateBadge = () => {
    /* NOOP */
};
window.badger.updateIcon = () => {
    /* NOOP */
};

// Disable privacy badger first run page
window.badger.showFirstRunPage = () => {
    /* NOOP */
};
