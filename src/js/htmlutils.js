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

require.scopes.htmlutils = (function() {

const i18n = chrome.i18n;
const constants = require("constants");

var exports = {};
var htmlUtils = exports.htmlUtils = {

  // Tooltipster config for domain list tooltips
  DOMAIN_TOOLTIP_CONF: {
    delay: 100,
    side: 'bottom',

    // allow per-instance option overriding
    functionInit: function (instance, helper) {
      let dataOptions = helper.origin.dataset.tooltipster;

      if (dataOptions) {
        try {
          dataOptions = JSON.parse(dataOptions);
        } catch (e) {
          console.error(e);
        }

        for (let name in dataOptions) {
          instance.option(name, dataOptions[name]);
        }
      }
    },
  },

  /**
   * Determines if radio input is checked based on origin's action.
   *
   * @param {String} inputAction Action of current radio input.
   * @param {String} originAction Action of current origin.
   * @returns {String} 'checked' if both actions match otherwise empty string.
   */
  isChecked: function(inputAction, originAction) {
    if ((originAction == constants.NO_TRACKING) || (originAction == constants.DNT)) {
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
    const messages = {
      block: i18n.getMessage('badger_status_block', "XXX"),
      cookieblock: i18n.getMessage('badger_status_cookieblock', "XXX"),
      noaction: i18n.getMessage('badger_status_noaction', "XXX"),
      allow: i18n.getMessage('badger_status_allow', "XXX"),
      dntTooltip: i18n.getMessage('dnt_tooltip')
    };
    return function (action, origin) {
      if (action == constants.DNT) {
        return messages.dntTooltip;
      }

      const rv_action = messages[action];

      if (!rv_action) {
        return origin;
      }

      return rv_action.replace("XXX", origin);
    };
  }()),
  /**
   * Gets HTML for origin action toggle switch (block, block cookies, allow).
   *
   * @param {String} origin Origin to get toggle for.
   * @param {String} action Current action of given origin.
   * @returns {String} HTML for toggle switch.
   */
  getToggleHtml: (function () {
    let tooltips = {
      block: i18n.getMessage('domain_slider_block_tooltip'),
      cookieblock: i18n.getMessage('domain_slider_cookieblock_tooltip'),
      allow: i18n.getMessage('domain_slider_allow_tooltip')
    };

    return function (origin, action) {
      var originId = origin.replace(/\./g, '-');

      var toggleHtml = '' +
        '<div class="switch-container ' + action + '">' +
        '<div class="switch-toggle switch-3 switch-candy">' +
        '<input id="block-' + originId + '" name="' + origin + '" value="0" type="radio" ' + htmlUtils.isChecked('block', action) + '><label title="' + tooltips.block + '" class="actionToggle tooltip" for="block-' + originId + '" data-origin="' + origin + '" data-action="block"></label>' +
        '<input id="cookieblock-' + originId + '" name="' + origin + '" value="1" type="radio" ' + htmlUtils.isChecked('cookieblock', action) + '><label title="' + tooltips.cookieblock + '" class="actionToggle tooltip" for="cookieblock-' + originId + '" data-origin="' + origin + '" data-action="cookieblock"></label>' +
        '<input id="allow-' + originId + '" name="' + origin + '" value="2" type="radio" ' + htmlUtils.isChecked('allow', action) + '><label title="' + tooltips.allow + '" class="actionToggle tooltip" for="allow-' + originId + '" data-origin="' + origin + '" data-action="allow"></label>' +
        '<a><img src="/icons/badger-slider-handle.png"></a></div></div>';

      return toggleHtml;
    };
  }()),

  /**
   * Get HTML for tracker container.
   *
   * @returns {String} HTML for empty tracker container.
   */
  getTrackerContainerHtml: function() {
    var trackerHtml = '' +
      '<div class="keyContainer">' +
      '<div class="key">' +
      '<img src="/icons/UI-icons-red.svg" class="tooltip" title="' + i18n.getMessage("tooltip_block") + '">' +
      '<img src="/icons/UI-icons-yellow.svg" class="tooltip" title="' + i18n.getMessage("tooltip_cookieblock") + '">' +
      '<img src="/icons/UI-icons-green.svg" class="tooltip" title="' + i18n.getMessage("tooltip_allow") + '">' +
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
   * @param {Boolean} show_breakage_warning
   * @returns {String} Origin HTML.
   */
  getOriginHtml: (function () {

    const breakage_warning_tooltip = i18n.getMessage('breakage_warning_tooltip'),
      undo_arrow_tooltip = i18n.getMessage('feed_the_badger_title'),
      dnt_icon_url = chrome.runtime.getURL('/icons/dnt-16.png');

    return function (origin, action, show_breakage_warning) {
      action = _.escape(action);
      origin = _.escape(origin);

      // Get classes for main div.
      var classes = ['clicker'];
      if (action.indexOf('user') === 0) {
        classes.push('userset');
        action = action.substr(5);
      }
      if (action === constants.BLOCK || action === constants.COOKIEBLOCK || action === constants.ALLOW || action === constants.NO_TRACKING) {
        classes.push(action);
      }
      // show warning when manually blocking a domain
      // that would have been cookieblocked otherwise
      if (show_breakage_warning) {
        classes.push('show-breakage-warning');
      }

      // If origin has been whitelisted set text for DNT.
      var whitelistedText = '';
      if (action == constants.DNT) {
        whitelistedText = '' +
          '<div id="dnt-compliant">' +
          '<a target=_blank href="https://privacybadger.org/#-I-am-an-online-advertising-tracking-company.--How-do-I-stop-Privacy-Badger-from-blocking-me">' +
          '<img src="' + dnt_icon_url + '"></a></div>';
      }

      // Construct HTML for origin.
      var actionDescription = htmlUtils.getActionDescription(action, origin);
      var originHtml = '<div class="' + classes.join(' ') + '" data-origin="' + origin + '">' +
        '<div class="origin">' +
        '<span class="ui-icon ui-icon-alert tooltip breakage-warning" title="' + breakage_warning_tooltip + '"></span>' +
        '<span class="origin-inner tooltip" title="' + actionDescription + '">' + whitelistedText + origin + '</span>' +
        '</div>' +
        '<div class="removeOrigin">&#10006</div>' +
        htmlUtils.getToggleHtml(origin, action) +
        '<div class="honeybadgerPowered tooltip" title="'+ undo_arrow_tooltip + '"></div>' +
        '</div>';

      return originHtml;
    };

  }()),

  /**
   * Toggle the GUI blocked status of GUI element(s)
   *
   * @param {jQuery} $el Identify the jQuery element object(s) to manipulate
   * @param {String} status New status to set
   * @param {Boolean} show_breakage_warning
   */
  toggleBlockedStatus: function ($el, status, show_breakage_warning) {
    $el.removeClass([
      constants.BLOCK,
      constants.COOKIEBLOCK,
      constants.ALLOW,
      constants.NO_TRACKING,
      "show-breakage-warning",
    ].join(" "));

    $el.addClass(status).addClass("userset");

    // show warning when manually blocking a domain
    // that would have been cookieblocked otherwise
    if (show_breakage_warning) {
      $el.addClass("show-breakage-warning");
    }
  },

  /**
   * Compare two domains, reversing them to start comparing the least
   * significant parts (TLD) first.
   *
   * @param {Array} domains The domains to sort.
   * @returns {Array} Sorted domains.
   */
  sortDomains: (domains) => {
    // optimization: cache makeSortable output by walking the array once
    // to extract the actual values used for sorting into a temporary array
    return domains.map((domain, i) => {
      return {
        index: i,
        value: htmlUtils.makeSortable(domain)
      };
    // sort the temporary array
    }).sort((a, b) => {
      if (a.value > b.value) {
        return 1;
      }
      if (a.value < b.value) {
        return -1;
      }
      return 0;
    // walk the temporary array to achieve the right order
    }).map(item => domains[item.index]);
  },

  /**
   * Reverse order of domain items to have the least exact (TLD) first.
   *
   * @param {String} domain The domain to shuffle
   * @returns {String} The 'reversed' domain
   */
  makeSortable: (domain) => {
    let base = window.getBaseDomain(domain),
      base_minus_tld = base,
      dot_index = base.indexOf('.'),
      rest_of_it_reversed = '';

    if (domain.length > base.length) {
      rest_of_it_reversed = domain
        .slice(0, domain.length - base.length - 1)
        .split('.').reverse().join('.');
    }

    if (dot_index > -1 && !window.isIPv4(domain) && !window.isIPv6(domain)) {
      base_minus_tld = base.slice(0, dot_index);
    }

    return (base_minus_tld + '.' + rest_of_it_reversed);
  },

};

return exports;

})();
