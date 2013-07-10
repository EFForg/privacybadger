/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

exports.__defineGetter__("addonID", function()
{
    return chrome.i18n.getMessage("@@extension_id");
});
exports.addonVersion = "2.1"; // Hardcoded for now
exports.__defineGetter__("addonName", function()
{
    return chrome.i18n.getMessage("name");
});
exports.addonRoot = "";
exports.application = "chrome";
