/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

require.scopes.htmlutils = (function () {

const i18n = chrome.i18n;
const constants = require("constants");

function escape_html(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let htmlUtils = {

  // default Tooltipster config
  TOOLTIPSTER_DEFAULTS: {
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

  // Tooltipster config for domain list tooltips
  DOMAIN_TOOLTIP_CONF: {
    delay: 100,
    side: 'bottom',
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

    function is_checked(input_action, origin_action) {
      if ((origin_action == constants.NO_TRACKING) || (origin_action == constants.DNT)) {
        origin_action = constants.ALLOW;
      }
      return (input_action === origin_action ? 'checked' : '');
    }

    let tooltips = {
      block: i18n.getMessage('domain_slider_block_tooltip'),
      cookieblock: i18n.getMessage('domain_slider_cookieblock_tooltip'),
      allow: i18n.getMessage('domain_slider_allow_tooltip')
    };

    return function (origin, action) {
      let origin_id = origin.replace(/\./g, '-');

      return `
<div class="switch-container ${action}">
  <div class="switch-toggle switch-3 switch-candy">
    <input id="block-${origin_id}" name="${origin}" value="${constants.BLOCK}" type="radio" aria-label="${tooltips.block}" ${is_checked(constants.BLOCK, action)}>
    <label title="${tooltips.block}" class="tooltip" for="block-${origin_id}"></label>
    <input id="cookieblock-${origin_id}" name="${origin}" value="${constants.COOKIEBLOCK}" type="radio" aria-label="${tooltips.cookieblock}" ${is_checked(constants.COOKIEBLOCK, action)}>
    <label title="${tooltips.cookieblock}" class="tooltip" for="cookieblock-${origin_id}"></label>
    <input id="allow-${origin_id}" name="${origin}" value="${constants.ALLOW}" type="radio" aria-label="${tooltips.allow}" ${is_checked(constants.ALLOW, action)}>
    <label title="${tooltips.allow}" class="tooltip" for="allow-${origin_id}"></label>
    <a></a>
  </div>
</div>
      `.trim();
    };

  }()),

  /**
   * Get HTML for tracker container.
   *
   * @returns {String} HTML for empty tracker container.
   */
  getTrackerContainerHtml: function() {
    return `
<div class="keyContainer">
  <div class="key">
    <img src="/icons/UI-icons-red.svg" class="tooltip" title="${i18n.getMessage("tooltip_block")}"><img src="/icons/UI-icons-yellow.svg" class="tooltip" title="${i18n.getMessage("tooltip_cookieblock")}"><img src="/icons/UI-icons-green.svg" class="tooltip" title="${i18n.getMessage("tooltip_allow")}">
  </div>
</div>
<div id="blockedResourcesInner" class="clickerContainer"></div>
    `.trim();
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
      action = escape_html(action);
      origin = escape_html(origin);

      // Get classes for main div.
      let classes = ['clicker'];
      if (action.startsWith('user')) {
        classes.push('userset');
        action = action.slice(5);
      }
      // show warning when manually blocking a domain
      // that would have been cookieblocked otherwise
      if (show_breakage_warning) {
        classes.push('show-breakage-warning');
      }

      // show the DNT icon for DNT-compliant domains
      let dnt_html = '';
      if (action == constants.DNT) {
        dnt_html = `
<div id="dnt-compliant">
  <a target=_blank href="https://privacybadger.org/#-I-am-an-online-advertising-tracking-company.--How-do-I-stop-Privacy-Badger-from-blocking-me"><img src="${dnt_icon_url}"></a>
</div>
        `.trim();
      }

      // construct HTML for domain
      let origin_tooltip = htmlUtils.getActionDescription(action, origin);
      return `
<div class="${classes.join(' ')}" data-origin="${origin}">
  <div class="origin" role="heading" aria-level="4">
    <span class="ui-icon ui-icon-alert tooltip breakage-warning" title="${breakage_warning_tooltip}"></span>
    <span class="origin-inner tooltip" title="${origin_tooltip}">${dnt_html}${origin}</span>
  </div>
  <a href="" class="removeOrigin">&#10006</a>
  ${htmlUtils.getToggleHtml(origin, action)}
  <a href="" class="honeybadgerPowered tooltip" title="${undo_arrow_tooltip}"></a>
</div>
      `.trim();
    };

  }()),

  /**
   * Toggles undo arrows and breakage warnings in domain slider rows.
   * TODO rename/refactor with updateOrigin()
   *
   * @param {jQuery} $clicker
   * @param {Boolean} userset whether to show a revert control arrow
   * @param {Boolean} show_breakage_warning whether to show a breakage warning
   */
  toggleBlockedStatus: function ($clicker, userset, show_breakage_warning) {
    $clicker.removeClass([
      "userset",
      "show-breakage-warning",
    ].join(" "));

    // toggles revert control arrow via CSS
    if (userset) {
      $clicker.addClass("userset");
    }

    // show warning when manually blocking a domain
    // that would have been cookieblocked otherwise
    if (show_breakage_warning) {
      $clicker.addClass("show-breakage-warning");
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

htmlUtils.escape = escape_html;

let exports = {
  htmlUtils,
};
return exports;

})();
