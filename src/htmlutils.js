/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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

var i18n = chrome.i18n;

require.scopes['htmlutils'] = (function() {

// Ugly HTML helpers.
// TODO: Some or all of these should be replace but have been moved here to
// eliminate code duplication elsewhere.
var exports = {};
var htmlUtils = exports.htmlUtils = {

  /**
   * Trims a given string to a given length if necessary.
   *
   * @param {String} inputString String to trim.
   * @param {Integer} maxLength Length to trim inputString to.
   * @returns {String} Trimmed string.
   */
  trim: function(inputString, maxLength) {
    if (inputString.length > maxLength) {
      return inputString.slice(0, maxLength - 3) + '...';
    } else {
      return inputString;
    }
  },

  /**
   * Determines if radio input is checked based on origin's action.
   *
   * @param {String} inputAction Action of current radio input.
   * @param {String} originAction Action of current origin.
   * @returns {String} 'checked' if both actions match otherwise empty string.
   */
  isChecked: function(inputAction, originAction) {
    return (inputAction === originAction) ? 'checked' : '';
  },

  /**
   * Gets localized description for given action and origin.
   *
   * @param {String} action The action to get description for.
   * @param {String} origin The origin to get description for.
   * @returns {String} Localized action description with origin.
   */
  getActionDescription: function(action, origin) {
    var actionDescriptions = {
      block: i18n.getMessage('badger_status_block'),
      cookieblock: i18n.getMessage('badger_status_cookieblock'),
      noaction: i18n.getMessage('badger_status_noaction'),
    };
    return actionDescriptions[action] + origin;
  },

  /**
   * Gets HTML for origin action toggle switch (block, block cookies, allow).
   *
   * @param {String} origin Origin to get toggle for.
   * @param {String} action Current action of given origin.
   * @returns {String} HTML for toggle switch.
   */
  getToggleHtml: function(origin, action) {
    var originId = origin.replace(/\./g, '-');
    var toggleHtml = '' +
      '<div class="switch-container ' + action + '">' +
      '<div class="switch-toggle switch-3 switch-candy">' +
      '<input id="block-' + originId + '" name="' + origin + '" value="0" type="radio" ' + htmlUtils.isChecked('block', action) + '><label tooltip="click here to block this tracker entirely" class="actionToggle" for="block-' + originId + '" data-origin="' + origin + '" data-action="block"></label>' +
      '<input id="cookieblock-' + originId + '" name="' + origin + '" value="1" type="radio" ' + htmlUtils.isChecked('cookieblock', action) + '><label tooltip="click here to block this tracker from setting cookies" class="actionToggle" for="cookieblock-' + originId + '" data-origin="' + origin + '" data-action="cookieblock"></label>' +
      '<input id="noaction-' + originId + '" name="' + origin + '" value="2" type="radio" ' + htmlUtils.isChecked('noaction', action) + '><label tooltip="click here to allow this tracker" class="actionToggle" for="noaction-' + originId + '" data-origin="' + origin + '" data-action="noaction"></label>' +
      '<a><img src="/icons/badger-slider-handle.png"></a></div></div>';
    return toggleHtml;
  },

  /**
   * Adds HTML for given origin to existing HTML.
   *
   * @param {String} existingHtml Existing HTML to append origin HTML to.
   * @param {String} origin Origin to get HTML for.
   * @param {String} action Action for given origin.
   * @param {Boolean} isWhitelisted Whether origin is whitelisted or not.
   * @param {Integer} subdomainCount Number of subdomains for given origin.
   * @returns {String} Existing HTML with origin HTML appended.
   */
  addOriginHtml: function(existingHtml, origin, action, isWhitelisted, subdomainCount) {
    // Get classes for main div and tooltip text for inner div.
    var tooltipText = '';
    var classes = ['clicker', 'tooltip'];
    if (action.indexOf('user') === 0) {
      tooltipText = i18n.getMessage('feed_the_badger_title');
      classes.push('userset');
      action = action.substr(4);
    }
    if (action === 'block' || action === 'cookieblock' || action === 'noaction') {
      classes.push(action);
    }
    var classText = 'class="' + classes.join(' ') + '"';

    // If origin has been whitelisted set text for DNT.
    var whitelistedText = '';
    if (isWhitelisted) {
      whitelistedText = '' +
        '<div id="dnt-compliant">' +
        '<a target=_blank href="https://www.eff.org/privacybadger#faq--I-am-an-online-advertising-/-tracking-company.--How-do-I-stop-Privacy-Badger-from-blocking-me?">' +
        '<img src="/icons/dnt-16.png" title="This domain promises not to track you."></a></div>';
    }

    // If there are multiple subdomains set text showing count.
    var subdomainText = '';
    if (subdomainCount) {
      subdomainText = ' (' + subdomainCount + ' subdomains)';
    }

    // Construct HTML for origin.
    var actionDescription = htmlUtils.getActionDescription(action, origin);
    var originHtml = '' +
      '<div ' + classText + ' data-origin="' + origin + '" tooltip="' + actionDescription + '" data-original-action="' + action + '">' +
      '<div class="origin">' + whitelistedText + htmlUtils.trim(origin + subdomainText, 30) + '</div>' +
      '<div class="removeOrigin">&#10006</div>' +
      htmlUtils.getToggleHtml(origin, action) +
      '<div class="honeybadgerPowered tooltip" tooltip="'+ tooltipText + '"></div>' +
      '<img class="tooltipArrow" src="/icons/badger-tb-arrow.png">' +
      '<div class="clear"></div>' +
      '<div class="tooltipContainer"></div>' +
      '</div>';

    return existingHtml + originHtml;
  },

};

return exports;

})();
