/*
 * Copyright (C) 2022 Surfboard Holding B.V. <https://www.startpage.com>
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
This provides overrides to https://github.com/Openmail/privacybadger/blob/master/src/js/constants.js
*/

var constants = require('constants');

constants.YELLOWLIST_URL = 'https://www.startpage.com/sp/cdn/eff/cookieblocklist_new.txt';
constants.DNT_POLICIES_URL = 'https://www.startpage.com/sp/cdn/eff/dnt-policies.json';
