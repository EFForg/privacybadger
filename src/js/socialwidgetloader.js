/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 * Derived from ShareMeNot
 * Copyright (C) 2011-2014 University of Washington
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

/*
 * ShareMeNot is licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2011-2014 University of Washington
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
/* globals chrome */

var utils = require('utils');

require.scopes.socialwidgetloader = (function() {

var exports = {};
exports.loadSocialWidgetsFromFile = loadSocialWidgetsFromFile;

/**
 * Loads a JSON file at filePath and returns the parsed object.
 *
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @param {Function} callback callback(jsonParsed)
 */
function loadJSONFromFile(filePath, callback) {
  getFileContents(filePath, function(jsonString) {
    var jsonParsed = JSON.parse(jsonString);
    Object.freeze(jsonParsed); // prevent modifications to jsonParsed

    callback(jsonParsed);
  });
}

/**
 * Returns the contents of the file at filePath.
 *
 * @param {String} filePath the path to the file
 * @param {Function} callback callback(responseText)
 */
function getFileContents(filePath, callback) {
  var url = chrome.extension.getURL(filePath);

  utils.xhrRequest(url, function(err, responseText) {
    if (err) {
      console.error(
        "Problem fetching contents of file at",
        filePath,
        err.status,
        err.message
      );
    } else {
      callback(responseText);
    }
  });
}

/**
 * Returns an array of SocialWidget objects that are loaded from the file at
 * filePath.
 *
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @param {Function} callback callback(socialwidgets)
 */
function loadSocialWidgetsFromFile(filePath, callback) {
  loadJSONFromFile(filePath, function(socialwidgetsJson) {
    var socialwidgets = [];

    // loop over each socialwidget, making a SocialWidget object
    for (var socialwidgetName in socialwidgetsJson) {
      var socialwidgetProperties = socialwidgetsJson[socialwidgetName];
      var socialwidgetObject = new SocialWidget(socialwidgetName, socialwidgetProperties);
      socialwidgets.push(socialwidgetObject);
    }

    callback(socialwidgets);
  });
}

/**
 * Constructs a SocialWidget with the given name and properties.
 *
 * @param {String} name the name of the socialwidget
 * @param {Object} properties the properties of the socialwidget
 */
function SocialWidget(name, properties) {
  this.name = name;

  for (var property in properties) {
    this[property] = properties[property];
  }
}

return exports;
})(); //require scopes
