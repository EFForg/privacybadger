/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2014 Electronic Frontier Foundation
 *
 * Derived from Adblock Plus
 * Copyright (C) 2006-2013 Eyeo GmbH
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

/* eslint-env browser, jquery */

const LOCALE = chrome.i18n.getMessage('@@ui_locale'),
  ON_POPUP = (document.location.pathname == "/skin/popup.html");

function localizeFaqLink() {
  const LOCALIZED_HOMEPAGE_LOCALES = ['es', 'fr', 'zh_CN'];
  if (ON_POPUP && LOCALIZED_HOMEPAGE_LOCALES.includes(LOCALE)) {
    // update FAQ link to point to localized version
    $('#help').prop('href', `https://privacybadger.org/${LOCALE.replace('_', '-').toLowerCase()}/#faq`);
  }
}

function setTextDirection() {
  function toggle_css_value(selector, property, from, to) {
    let $els = $(selector);
    $els.each(i => {
      let $el = $($els[i]);
      if ($el.css(property) === from) {
        $el.css(property, to);
      }
    });
  }

  // https://www.w3.org/International/questions/qa-scripts#examples
  // https://developer.chrome.com/docs/webstore/i18n/?csw=1#choosing-locales-to-support
  // TODO duplicated in src/js/webrequest.js
  const RTL_LOCALES = ['ar', 'he', 'fa'];
  if (!RTL_LOCALES.includes(LOCALE)) {
    return;
  }

  // set body text direction
  document.body.setAttribute("dir", "rtl");

  // popup page
  if (ON_POPUP) {
    // fix floats
    ['#badger-header-logo', '#header-image-stack', '#header-image-stack a', '#header-image-stack img'].forEach((selector) => {
      toggle_css_value(selector, "float", "left", "right");
    });
    ['#fittslaw', '#options', '#help', '#share', '.overlay_close'].forEach((selector) => {
      toggle_css_value(selector, "float", "right", "left");
    });

  // options page
  } else if (document.location.pathname == "/skin/options.html") {
    // apply RTL workaround for jQuery UI tabs
    // https://zoomicon.wordpress.com/2009/10/15/how-to-use-jqueryui-tabs-in-right-to-left-layout/
    let css = document.createElement("style");
    css.type = "text/css";
    css.textContent = `
.ui-tabs { direction: rtl; }
.ui-tabs .ui-tabs-nav li.ui-tabs-selected,
  .ui-tabs .ui-tabs-nav li.ui-state-default { float: right; }
.ui-tabs .ui-tabs-nav li a { float: right; }
`;
    document.body.appendChild(css);

    // fix floats
    ['.btn-silo', '.btn-silo div', '#allowlist-form > div > div > div', '#widget-site-exceptions-select-div', '#widget-site-exceptions-remove-button'].forEach((selector) => {
      toggle_css_value(selector, "float", "left", "right");
    });
  }
}

/**
 * Loads and inserts i18n strings into matching elements.
 */
function loadI18nStrings() {
  let els = document.querySelectorAll("[class^='i18n_']");

  // replace element contents by their class names
  for (let el of els) {
    const key = el.className.split(/\s/)[0].slice(5),
      prop = ("innerHTML" in el ? "innerHTML" : "textContent");

    // get chrome.i18n placeholders, if any
    let placeholders = el.dataset.i18n_contents_placeholders;
    placeholders = (placeholders ? placeholders.split("@@") : []);

    // replace contents
    el[prop] = chrome.i18n.getMessage(key, placeholders);
  }

  // also replace alt, placeholder, title and aria-label attributes
  const ATTRS = [
    'alt',
    'placeholder',
    'title',
    'aria-label',
  ];

  // get all the elements that contain one or more of these attributes
  els = document.querySelectorAll(
    // for example: "[placeholder^='i18n_'], [title^='i18n_']"
    "[" + ATTRS.join("^='i18n_'], [") + "^='i18n_']"
  );

  // for each element
  for (let el of els) {
    // for each attribute
    for (let attr_type of ATTRS) {
      // get the translation message key
      let key = el.getAttribute(attr_type);

      // attribute exists
      if (key) {
        // remove the i18n_ prefix
        key = key.startsWith("i18n_") && key.slice(5);
      }

      if (!key) {
        continue;
      }

      // get chrome.i18n placeholders, if any
      // TODO multiple attributes are not supported
      let placeholders = el.dataset.i18n_attribute_placeholders;
      placeholders = (placeholders ? placeholders.split("@@") : []);

      // update the attribute with the result of a translation lookup by KEY
      el.setAttribute(attr_type, chrome.i18n.getMessage(key, placeholders));
    }
  }
}

// Fill in the strings as soon as possible
window.addEventListener("DOMContentLoaded", function () {
  localizeFaqLink();
  setTextDirection();
  loadI18nStrings();
}, true);
