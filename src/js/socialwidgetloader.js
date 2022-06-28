/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

import { log } from "./bootstrap.js";
import utils from "./utils.js";

/**
 * Returns the contents of the file at given path.
 *
 * @param {String} file_path the path to the file
 * @param {Function} callback the callback
 */
function getFileContents(file_path, callback) {
  let url = chrome.runtime.getURL(file_path);
  utils.fetchResource(url, function (err, response_text) {
    if (err) {
      console.error(`Problem fetching contents of ${file_path}: ${err}`);
    } else {
      callback(response_text);
    }
  });
}

/**
 * @param {String} file_path the path to the JSON file
 * @returns {Promise} resolved with an array of SocialWidget objects
 */
function loadWidgetsFromFile(file_path) {
  return new Promise(function (resolve) {
    getFileContents(file_path, function (contents) {
      let widgets = initializeWidgets(JSON.parse(contents));
      log("Initialized widgets from disk");
      resolve(widgets);
    });
  });
}

/**
 * @param {Object} widgetsJson widget data
 * @returns {Array} array of SocialWidget objects
 */
function initializeWidgets(widgetsJson) {
  let widgets = [];

  // loop over each widget, making a SocialWidget object
  for (let widget_name in widgetsJson) {
    let widgetProperties = widgetsJson[widget_name];
    let widget = new SocialWidget(widget_name, widgetProperties);
    widgets.push(widget);
  }

  return widgets;
}

/**
 * Constructs a SocialWidget with the given name and properties.
 *
 * @param {String} name the name of the socialwidget
 * @param {Object} properties the properties of the socialwidget
 */
function SocialWidget(name, properties) {
  let self = this;

  self.name = name;

  for (let property in properties) {
    self[property] = properties[property];
  }

  // standardize on "domains"
  if (self.domain) {
    self.domains = [self.domain];
  }
}

export default {
  initializeWidgets,
  loadWidgetsFromFile,
};
