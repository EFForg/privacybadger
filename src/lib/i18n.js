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

var i18n = chrome.i18n;

// Loads and inserts i18n strings into matching elements. Any inner HTML already in the
// element is parsed as JSON and used as parameters to substitute into placeholders in the
// i18n message.
function loadI18nStrings() {
  // replace span contents by their class names
  let nodes = document.querySelectorAll("[class^='i18n_']");
  for (let i = 0; i < nodes.length; i++) {
    var arguments = JSON.parse("[" + nodes[i].textContent + "]");
    var className = nodes[i].className;
    if (className instanceof SVGAnimatedString)
      className = className.animVal;
    var stringName = className.split(/\s/)[0].substring(5);
    var prop = "innerHTML" in nodes[i] ? "innerHTML" : "textContent";
    if(arguments.length > 0)
      nodes[i][prop] = i18n.getMessage(stringName, arguments);
    else
      nodes[i][prop] = i18n.getMessage(stringName);
  }

  // also replace title and placeholder attributes
  const ATTRS = [
    'placeholder',
    'title',
  ];

  // get all the elements that contain one or more of these attributes
  nodes = document.querySelectorAll(
    // for example: "[placeholder^='i18n_'], [title^='i18n_']"
    "[" + ATTRS.join("^='i18n_'], [") + "^='i18n_']"
  );

  // for each element
  for (let i = 0; i < nodes.length; i++) {
    // for each attribute
    ATTRS.forEach(attr_type => {
      // get the translation message key
      let key = nodes[i].getAttribute(attr_type);
      if (key) {
        // remove the i18n_ prefix
        key = key.slice(5);
      }

      // if the attribute exists and looks like i18n_KEY
      if (key) {
        // get chrome.i18n placeholders, if any
        let placeholders = nodes[i].dataset.i18n_placeholders;
        if (placeholders) {
          placeholders = placeholders.split("@@");
        } else {
          placeholders = [];
        }

        // update the attribute with the result of a translation lookup by KEY
        nodes[i].setAttribute(attr_type, i18n.getMessage(key, placeholders));
      }
    });
  }
}

// Fill in the strings as soon as possible
window.addEventListener("DOMContentLoaded", loadI18nStrings, true);
