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

/* eslint-env browser, jquery */

import { isIPv4, isIPv6, getBaseDomain } from "../lib/basedomain.js";

import constants from "./constants.js";

const i18n = chrome.i18n;

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
    delay: 100,
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
   * Gets localized description for given domain and action.
   *
   * @param {String} action the action to get description for
   * @param {String} fqdn the domain to get description for
   * @param {?Array} [blockedFpScripts]
   *
   * @returns {String} the description
   */
  getActionDescription: (function () {

    const messages = {
      block: i18n.getMessage('badger_status_block', "XXX"),
      cookieblock: i18n.getMessage('badger_status_cookieblock', "XXX"),
      blockedScripts: i18n.getMessage('badger_status_blocked_scripts', "XXX"),
      noaction: i18n.getMessage('badger_status_noaction', "XXX"),
      allow: i18n.getMessage('badger_status_allow', "XXX"),
      dntTooltip: i18n.getMessage('dnt_tooltip')
    };

    return function (action, fqdn, blockedFpScripts) {
      if (action.startsWith('user')) {
        action = action.slice(5);
      }

      if (action == constants.DNT) {
        return messages.dntTooltip;
      }

      if (blockedFpScripts) {
        return messages.blockedScripts.replace("XXX", fqdn);
      }

      const rv_action = messages[action];

      if (!rv_action) {
        return fqdn;
      }

      return rv_action.replace("XXX", fqdn);
    };

  }()),

  /**
   * Gets HTML for domain action toggle switch.
   *
   * @param {String} fqdn the domain to get toggle for
   * @param {String} action the current action of given domain
   *
   * @returns {String} the HTML for toggle switch
   */
  getToggleHtml: (function () {

    function is_checked(input_action, action) {
      if (action == constants.NO_TRACKING || action == constants.DNT) {
        action = constants.ALLOW;
      }
      return (input_action === action ? 'checked' : '');
    }

    let tooltips = {
      block: i18n.getMessage('domain_slider_block_tooltip'),
      cookieblock: i18n.getMessage('domain_slider_cookieblock_tooltip'),
      allow: i18n.getMessage('domain_slider_allow_tooltip')
    };

    return function (fqdn, action) {
      let id = fqdn.replace(/\./g, '-');
      return `
<div class="switch-container ${action}">
  <div class="switch-toggle switch-3 switch-candy">
    <input id="block-${id}" name="${fqdn}" value="${constants.BLOCK}" type="radio" aria-label="${tooltips.block}" ${is_checked(constants.BLOCK, action)}>
    <label title="${tooltips.block}" class="tooltip" for="block-${id}"></label>
    <input id="cookieblock-${id}" name="${fqdn}" value="${constants.COOKIEBLOCK}" type="radio" aria-label="${tooltips.cookieblock}" ${is_checked(constants.COOKIEBLOCK, action)}>
    <label title="${tooltips.cookieblock}" class="tooltip" for="cookieblock-${id}"></label>
    <input id="allow-${id}" name="${fqdn}" value="${constants.ALLOW}" type="radio" aria-label="${tooltips.allow}" ${is_checked(constants.ALLOW, action)}>
    <label title="${tooltips.allow}" class="tooltip" for="allow-${id}"></label>
    <a></a>
  </div>
</div>
      `.trim();
    };

  }()),

  /**
   * Generates HTML for given FQDN.
   *
   * @param {String} fqdn the FQDN to get HTML for
   * @param {String} action the action for given FQDN
   * @param {Boolean} [show_breakage_warning]
   * @param {Boolean} [show_breakage_note]
   * @param {?Array} [blockedFpScripts]
   *
   * @returns {String} the slider HTML for the FQDN
   */
  // TODO origin --> domain/FQDN
  getOriginHtml: (function () {

    const breakage_warning_tooltip = i18n.getMessage('breakage_warning_tooltip'),
      undo_arrow_tooltip = i18n.getMessage('feed_the_badger_title'),
      dnt_icon_url = chrome.runtime.getURL('/icons/dnt-16.png');

    return function (fqdn, action, show_breakage_warning, show_breakage_note, blockedFpScripts) {
      action = escape_html(action);
      fqdn = escape_html(fqdn);

      // Get classes for main div.
      let classes = ['clicker'];
      // show warning when manually blocking a domain
      // that would have been cookieblocked otherwise
      if (show_breakage_warning) {
        classes.push('show-breakage-warning');
      }
      if (show_breakage_note) {
        classes.push('breakage-note');
      }
      // manually-set sliders get an undo arrow
      if (action.startsWith('user')) {
        classes.push('userset');
        action = action.slice(5);
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

      let shield_icon = '';
      if (blockedFpScripts) {
        shield_icon = '<span class="ui-icon ui-icon-shield"></span>';
      }

      // construct HTML for domain
      let domain_tooltip = htmlUtils.getActionDescription(action, fqdn, blockedFpScripts);

      return `
<div class="${classes.join(' ')}" data-origin="${fqdn}">
  <div class="origin" role="heading" aria-level="4">
    <span class="ui-icon ui-icon-alert tooltip breakage-warning" title="${breakage_warning_tooltip}"></span>
    <span class="origin-inner tooltip" title="${domain_tooltip}">${dnt_html}${shield_icon}${fqdn}</span>
  </div>
  <a href="" class="removeOrigin">&#10006</a>
  ${htmlUtils.getToggleHtml(fqdn, action, blockedFpScripts)}
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
    domains = domains || [];
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
    let base = getBaseDomain(domain),
      base_minus_tld = base,
      dot_index = base.indexOf('.'),
      rest_of_it_reversed = '';

    if (domain.length > base.length) {
      rest_of_it_reversed = domain
        .slice(0, domain.length - base.length - 1)
        .split('.').reverse().join('.');
    }

    if (dot_index > -1 && !isIPv4(domain) && !isIPv6(domain)) {
      base_minus_tld = base.slice(0, dot_index);
    }

    return (base_minus_tld + '.' + rest_of_it_reversed);
  },

  /**
   * Checks whether an element is at least partially visible
   * within its scrollable container.
   *
   * @param {Element} elm
   * @param {Element} container
   *
   * @returns {Boolean}
   */
  isScrolledIntoView: (elm, container) => {
    let ctop = container.scrollTop,
      cbot = ctop + container.clientHeight,
      etop = elm.offsetTop,
      ebot = etop + elm.clientHeight;

    // completely in view
    if (etop >= ctop && ebot <= cbot) {
      return true;
    }

    // partially in view
    if ((etop < ctop && ebot > ctop) || (ebot > cbot && etop < cbot)) {
      return true;
    }

    return false;
  },

};

htmlUtils.escape = escape_html;

export default htmlUtils;
