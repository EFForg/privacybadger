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

require.scopes.htmlutils = (function() {

var constants = chrome.extension.getBackgroundPage().constants;

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
    if((originAction == constants.NO_TRACKING) || (originAction == constants.DNT)) {
      originAction = constants.ALLOW;
    }
    return (inputAction === originAction) ? 'checked' : '';
  },

  /**
   * Gets localized description for given action and origin.
   *
   * @param {String} action The action to get description for.
   * @param {String} origin The origin to get description for.
   * @returns {String} Localized action description with origin.
   */
  getActionDescription: (function () {
    var actionDescriptions = {
      block: i18n.getMessage('badger_status_block'),
      cookieblock: i18n.getMessage('badger_status_cookieblock'),
      noaction: i18n.getMessage('badger_status_noaction'),
      allow: i18n.getMessage('badger_status_allow'),
      dntTooltip: i18n.getMessage('dnt_tooltip')
    };
    return function(action, origin, isWhitelisted) {
      var rv_action = actionDescriptions[action];
      if (typeof(isWhitelisted) !== 'undefined' && isWhitelisted) {
        return actionDescriptions.dntTooltip;
      } else if (typeof(rv_action) == 'undefined'){
        return origin;
      } else {
        return rv_action + origin;
      }
    };
  }()),
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
      '<input id="allow-' + originId + '" name="' + origin + '" value="2" type="radio" ' + htmlUtils.isChecked('allow', action) + '><label tooltip="click here to allow this tracker" class="actionToggle" for="allow-' + originId + '" data-origin="' + origin + '" data-action="allow"></label>' +
      '<a><img src="/icons/badger-slider-handle.png"></a></div></div>';
    return toggleHtml;
  },

  /**
   * Get HTML for tracker container.
   *
   * @param {Integer} tabId ID of tab trackers are associated with.
   * @returns {String} HTML for empty tracker container.
   */
  getTrackerContainerHtml: function(tabId) {
    if (tabId === undefined) {
      tabId = "000";
    }
    var trackerHtml = '' +
      '<div id="associatedTab" data-tab-id="' + tabId + '"></div>' +
      '<div class="keyContainer">' +
      '<div class="key">' +
      '<img class="tooltip" src="/icons/UI-icons-red.svg" tooltip="' + i18n.getMessage("tooltip_block") + '">' +
      '<img class="tooltip" src="/icons/UI-icons-yellow.svg" tooltip="' + i18n.getMessage("tooltip_cookieblock") + '">' +
      '<img class="tooltip" src="/icons/UI-icons-green.svg" tooltip="' + i18n.getMessage("tooltip_allow") + '">' +
      '<div class="tooltipContainer"></div>' +
      '</div></div>' +
      '<div class="spacer"></div>' +
      '<div id="blockedResourcesInner" class="clickerContainer"></div>';
    return trackerHtml;
  },

  /**
   * Generates HTML for given origin.
   *
   * @param {String} origin Origin to get HTML for.
   * @param {String} action Action for given origin.
   * @param {Boolean} isWhitelisted Whether origin is whitelisted or not.
   * @param {Integer} subdomainCount Number of subdomains for given origin.
   * @returns {String} Origin HTML.
   */
  getOriginHtml: function(origin, action, isWhitelisted, subdomainCount) {
    // Get classes for main div and tooltip text for inner div.
    var tooltipText = '';
    var classes = ['clicker', 'tooltip'];
    action = _.escape(action);
    origin = _.escape(origin);
    if (action.indexOf('user') === 0) {
      tooltipText = i18n.getMessage('feed_the_badger_title');
      classes.push('userset');
      action = action.substr(5);
    }
    if (action === constants.BLOCK || action === constants.COOKIEBLOCK || action === constants.ALLOW || action === constants.NO_TRACKING) {
      classes.push(action);
    }
    var classText = 'class="' + classes.join(' ') + '"';

    // If origin has been whitelisted set text for DNT.
    var whitelistedText = '';
    if (isWhitelisted) {
      whitelistedText = '' +
        '<div id="dnt-compliant">' +
        '<a target=_blank href="https://www.eff.org/privacybadger#faq--I-am-an-online-advertising-/-tracking-company.--How-do-I-stop-Privacy-Badger-from-blocking-me?">' +
        '<img src="' +
        chrome.extension.getURL('/icons/dnt-16.png') +
        '"></a></div>';
    }

    // If there are multiple subdomains set text showing count.
    var subdomainText = '';
    if (subdomainCount) {
      subdomainText = ' (' + subdomainCount + ' subdomains)';
    }

    // Construct HTML for origin.
    var actionDescription = htmlUtils.getActionDescription(action, origin, isWhitelisted);
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

    return originHtml;
  },
  /**
  * Toggle the GUI blocked status of GUI element(s)
  *
  * @param {String} elt Identify the object(s) to manipulate
  * @param {String} status New status to set, optional
  */
  toggleBlockedStatus: function (elt,status) {
    console.log('toggle blocked status', elt, status);
    if(status){
      elt.removeClass([constants.BLOCK, constants.COOKIEBLOCK, constants.ALLOW, constants.NO_TRACKING].join(" ")).addClass(status);
      elt.addClass("userset");
      return;
    }

    var originalAction = elt.getAttribute('data-original-action');
    if (elt.hasClass(constants.BLOCK)) {
      elt.toggleClass(constants.BLOCK);
    } else if (elt.hasClass(constants.COOKIEBLOCK)) {
      elt.toggleClass(constants.BLOCK);
      elt.toggleClass(constants.COOKIEBLOCK);
    } else {
      elt.toggleClass(constants.COOKIEBLOCK);
    }
    if (elt.hasClass(originalAction) || (originalAction == constants.ALLOW && !(elt.hasClass(constants.BLOCK) ||
                                                                              elt.hasClass(constants.COOKIEBLOCK)))) {
      elt.removeClass("userset");
    } else {
      elt.addClass("userset");
    }
  },

  /**
  * Compare 2 domains. Reversing them to start comparing the least significant parts (TLD) first
  *
  * @param a First domain
  * @param b Second domain
  * @returns {number} standard compare returns
  */
  compareReversedDomains: function(a, b){
    var fqdn1 = htmlUtils.makeSortable(a);
    var fqdn2 = htmlUtils.makeSortable(b);
    if(fqdn1 < fqdn2){
      return -1;
    }
    if(fqdn1 > fqdn2){
      return 1;
    }
    return 0;
  },

  /**
  * Reverse order of domain items to have the least exact (TLD) first)
  *
  * @param {String} domain The domain to shuffle
  * @returns {String} The 'reversed' domain
  */
  makeSortable: function(domain){
    var tmp = domain.split('.').reverse();
    tmp.shift();
    return tmp.join('');
  },

  /**
  * Get the action class from the element
  *
  * @param elt Element
  * @returns {String} block/cookieblock/noaction
  */
  getCurrentClass: function(elt) {
    if (elt.hasClass(constants.BLOCK)) {
      return constants.BLOCK;
    } else if (elt.hasClass(constants.COOKIEBLOCK)) {
      return constants.COOKIEBLOCK;
    } else if (elt.hasClass(constants.ALLOW)) {
      return constants.ALLOW;
    } else {
      return constants.NO_TRACKING;
    }
  },

};

return exports;

})();
