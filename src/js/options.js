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

import { getBaseDomain } from "../lib/basedomain.js";
import { filterDomains } from "../lib/options.js";

import constants from "./constants.js";
import htmlUtils from "./htmlutils.js";
import utils from "./utils.js";

window.OPTIONS_INITIALIZED = false;
window.SLIDERS_DONE = false;

const TOOLTIP_CONF = {
  maxWidth: 400
};
const USER_DATA_EXPORT_KEYS = [
  "action_map",
  "snitch_map",
  "settings_map",
  "tracking_map",
  "fp_scripts",
];

let i18n = chrome.i18n;

let OPTIONS_DATA = {};

/*
 * Loads options from pb storage and sets UI elements accordingly.
 */
function loadOptions() {
  // Set page title to i18n version of "Privacy Badger Options"
  document.title = i18n.getMessage("options_title");

  // Add event listeners
  $("#allowlist-form").on("submit", addDisabledSite);
  $("#remove-disabled-site").on("click", removeDisabledSite);
  $("#cloud-upload").on("click", uploadCloud);
  $("#cloud-download").on("click", downloadCloud);
  $('#importTrackerButton').on("click", loadFileChooser);
  $('#importTrackers').on("change", importTrackerList);
  $('#exportTrackers').on("click", exportUserData);
  $('#resetData').on("click", resetData);
  $('#removeAllData').on("click", removeAllData);
  $('#widget-site-exceptions-remove-button').on("click", removeWidgetSiteExceptions);
  $('#tip-header').on('click', toggleDisabledSitesTip);

  // Set up input for searching through tracking domains.
  $("#trackingDomainSearch").on("input", utils.debounce(filterTrackingDomains, 500));
  $("#tracking-domains-type-filter").on("change", filterTrackingDomains);
  $("#tracking-domains-status-filter").on("change", filterTrackingDomains);
  $("#tracking-domains-show-not-yet-blocked").on("change", filterTrackingDomains);
  $("#tracking-domains-hide-in-seed").on("change", filterTrackingDomains);

  // Add event listeners for domain toggles container.
  $('#blockedResourcesContainer').on('change', 'input:radio', function () {
    let $radio = $(this),
      $clicker = $radio.parents('.clicker').first(),
      domain = $clicker.data('origin'),
      action = $radio.val();

    // update domain slider row tooltip/status indicators
    updateOrigin(domain, action, true);

    // persist the change
    saveToggle(domain, action);
  });
  $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
  $('#blockedResourcesContainer').on('click', '.removeOrigin', removeDomain);
  $('#blockedResourcesInner').on('scroll', function () {
    activateDomainListTooltips();
  });

  // Display jQuery UI elements
  $("#tabs").tabs({
    activate: function (_, ui) {
      let tab_id = ui.newPanel.attr('id');
      if (tab_id == 'tab-tracking-domains') {
        activateDomainListTooltips();
      }
      // update options page URL fragment identifier
      // to preserve selected tab on page reload
      history.replaceState(null, null, "#" + tab_id);
    }
  });
  $("button").button();
  $("#add-disabled-site").button("option", "icons", {primary: "ui-icon-plus"});
  $("#remove-disabled-site").button("option", "icons", {primary: "ui-icon-minus"});
  $("#cloud-upload").button("option", "icons", {primary: "ui-icon-arrowreturnthick-1-n"});
  $("#cloud-download").button("option", "icons", {primary: "ui-icon-arrowreturnthick-1-s"});
  $(".importButton").button("option", "icons", {primary: "ui-icon-plus"});
  $("#exportTrackers").button("option", "icons", {primary: "ui-icon-extlink"});
  $("#resetData").button("option", "icons", {primary: "ui-icon-arrowrefresh-1-w"});
  $("#removeAllData").button("option", "icons", {primary: "ui-icon-closethick"});
  $("#show_counter_checkbox").on("click", updateShowCounter);
  $("#show_counter_checkbox").prop("checked", OPTIONS_DATA.settings.showCounter);
  $("#enable_dnt_checkbox").on("click", updateDNTCheckboxClicked);
  $("#enable_dnt_checkbox").prop("checked", OPTIONS_DATA.settings.sendDNTSignal);
  $("#check_dnt_policy_checkbox").on("click", updateCheckingDNTPolicy);
  $("#check_dnt_policy_checkbox").prop("checked", OPTIONS_DATA.settings.checkForDNTPolicy).prop("disabled", !OPTIONS_DATA.settings.sendDNTSignal);

  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.networkPredictionEnabled) {
    $("#privacy-settings-header").show();
    $("#disable-network-prediction").show();
    $('#disable-network-prediction-checkbox')
      .prop("checked", OPTIONS_DATA.settings.disableNetworkPrediction)
      .on("click", function () {
        updatePrivacyOverride(
          "disableNetworkPrediction",
          $("#disable-network-prediction-checkbox").prop("checked")
        );
      });
    // use a different help link in Firefox
    if (chrome.runtime.getBrowserInfo) {
      chrome.runtime.getBrowserInfo((info) => {
        if (info.name == "Firefox" || info.name == "Waterfox") {
          $('#disable-network-prediction-help-link')[0].href = "https://developer.mozilla.org/en-US/docs/Web/HTTP/Link_prefetching_FAQ";
        }
      });
    }
  }

  if (chrome.privacy && chrome.privacy.services && chrome.privacy.services.alternateErrorPagesEnabled) {
    $("#privacy-settings-header").show();
    $("#disable-google-nav-error-service").show();
    $('#disable-google-nav-error-service-checkbox')
      .prop("checked", OPTIONS_DATA.settings.disableGoogleNavErrorService)
      .on("click", function () {
        updatePrivacyOverride(
          "disableGoogleNavErrorService",
          $("#disable-google-nav-error-service-checkbox").prop("checked")
        );
      });
  }

  if (chrome.privacy && chrome.privacy.websites && chrome.privacy.websites.hyperlinkAuditingEnabled) {
    $("#privacy-settings-header").show();
    $("#disable-hyperlink-auditing").show();
    $("#disable-hyperlink-auditing-checkbox")
      .prop("checked", OPTIONS_DATA.settings.disableHyperlinkAuditing)
      .on("click", function () {
        updatePrivacyOverride(
          "disableHyperlinkAuditing",
          $("#disable-hyperlink-auditing-checkbox").prop("checked")
        );
      });
  }

  if (chrome.privacy && chrome.privacy.websites && chrome.privacy.websites.topicsEnabled) {
    $("#disable-topics").show();
    $("#disable-topics-checkbox")
      .prop("checked", OPTIONS_DATA.settings.disableTopics)
      .on("click", function () {
        updatePrivacyOverride(
          "disableTopics", $("#disable-topics-checkbox").prop("checked"));
      });
  }

  $('#local-learning-checkbox')
    .prop("checked", OPTIONS_DATA.settings.learnLocally)
    .on("click", (event) => {
      const enabled = $(event.currentTarget).prop("checked");
      chrome.runtime.sendMessage({
        type: "updateSettings",
        data: {
          learnLocally: enabled
        }
      }, function () {
        $("#learn-in-incognito-checkbox")
          .prop("disabled", (enabled ? false : "disabled"))
          .prop("checked", (enabled ? OPTIONS_DATA.settings.learnInIncognito : false));
        $("#show-nontracking-domains-checkbox")
          .prop("disabled", (enabled ? false : "disabled"))
          .prop("checked", (enabled ? OPTIONS_DATA.settings.showNonTrackingDomains : false));

        $("#learning-setting-divs").slideToggle(enabled);

        if (!enabled) {
          let rerender = false,
            $showNotYetBlocked = $('#tracking-domains-show-not-yet-blocked'),
            $hideInSeed = $('#tracking-domains-hide-in-seed');

          if ($showNotYetBlocked.prop("checked")) {
            $showNotYetBlocked.prop("checked", false);
            rerender = true;
          }
          if ($hideInSeed.prop("checked")) {
            $hideInSeed.prop("checked", false);
            rerender = true;
          }

          if (rerender) {
            filterTrackingDomains();
          }
        }

        if (!enabled || (new URLSearchParams(document.location.search)).has('all')) {
          $("#not-yet-blocked-filter").toggle(enabled);
        }
        $("#hide-in-seed-filter").toggle(enabled);
      });
    });
  if (OPTIONS_DATA.settings.learnLocally) {
    $("#learning-setting-divs").show();
    if ((new URLSearchParams(document.location.search)).has('all')) {
      $("#not-yet-blocked-filter").show();
    }
    $("#hide-in-seed-filter").show();
  }

  $("#learn-in-incognito-checkbox")
    .prop("disabled", OPTIONS_DATA.settings.learnLocally ? false : "disabled")
    .prop("checked", (
      OPTIONS_DATA.settings.learnLocally ?
        OPTIONS_DATA.settings.learnInIncognito : false
    ))
    .on("click", (event) => {
      const enabled = $(event.currentTarget).prop("checked");
      chrome.runtime.sendMessage({
        type: "updateSettings",
        data: {
          learnInIncognito: enabled
        }
      }, function () {
        OPTIONS_DATA.settings.learnInIncognito = enabled;
      });
    });

  $('#show-nontracking-domains-checkbox')
    .prop("disabled", OPTIONS_DATA.settings.learnLocally ? false : "disabled")
    .prop("checked", (
      OPTIONS_DATA.settings.learnLocally ?
        OPTIONS_DATA.settings.showNonTrackingDomains : false
    ))
    .on("click", (event) => {
      const enabled = $(event.currentTarget).prop("checked");
      chrome.runtime.sendMessage({
        type: "updateSettings",
        data: {
          showNonTrackingDomains: enabled
        }
      }, function () {
        OPTIONS_DATA.settings.showNonTrackingDomains = enabled;
      });
    });

  const $widgetExceptions = $("#hide-widgets-select");

  // Initialize Select2 and populate options
  $widgetExceptions.select2({
    width: '100%'
  });
  OPTIONS_DATA.widgets.forEach(function (key) {
    const isSelected = OPTIONS_DATA.settings.widgetReplacementExceptions && OPTIONS_DATA.settings.widgetReplacementExceptions.includes(key);
    const option = new Option(key, key, false, isSelected);
    $widgetExceptions.append(option).trigger("change");
  });

  $widgetExceptions.on('select2:select', updateWidgetReplacementExceptions);
  $widgetExceptions.on('select2:unselect', updateWidgetReplacementExceptions);
  $widgetExceptions.on('select2:clear', updateWidgetReplacementExceptions);

  reloadDisabledSites();
  reloadTrackingDomainsTab();
  reloadWidgetSiteExceptions();

  $('html').css({
    overflow: 'visible',
    visibility: 'visible'
  });

  window.OPTIONS_INITIALIZED = true;
}

/**
 * Opens the file chooser to allow a user to select
 * a file to import.
 */
function loadFileChooser() {
  var fileChooser = document.getElementById('importTrackers');
  fileChooser.click();
}

/**
 * Import a list of trackers supplied by the user
 * NOTE: list must be in JSON format to be parsable
 */
function importTrackerList() {
  var file = this.files[0];

  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      parseUserDataFile(e.target.result);
    };
  } else {
    alert(i18n.getMessage("import_select_file"));
  }

  document.getElementById("importTrackers").value = '';
}

/**
 * Parses Privacy Badger data uploaded by the user.
 *
 * @param {String} storageMapsList data from JSON file that user provided
 */
function parseUserDataFile(storageMapsList) {
  let data;

  try {
    data = JSON.parse(storageMapsList);
  } catch (e) {
    return alert(i18n.getMessage("invalid_json"));
  }

  // validate keys ("action_map" and "snitch_map" are required)
  if (!['action_map', 'snitch_map'].every(i => utils.hasOwn(data, i))) {
    return alert(i18n.getMessage("invalid_json"));
  }

  chrome.runtime.sendMessage({
    type: "mergeUserData",
    data
  }, () => {
    alert(i18n.getMessage("import_successful"));
    location.reload();
  });
}

function resetData() {
  if (confirm(i18n.getMessage("reset_data_confirm"))) {
    chrome.runtime.sendMessage({type: "resetData"}, () => {
      // reload page to refresh tracker list
      location.reload();
    });
  }
}

function removeAllData() {
  if (confirm(i18n.getMessage("remove_all_data_confirm"))) {
    chrome.runtime.sendMessage({type: "removeAllData"}, () => {
      location.reload();
    });
  }
}

function downloadCloud() {
  chrome.runtime.sendMessage({type: "downloadCloud"},
    function (response) {
      if (response.success) {
        alert(i18n.getMessage("download_cloud_success"));
        OPTIONS_DATA.settings.disabledSites = response.disabledSites;
        reloadDisabledSites();
      } else {
        console.error("Cloud sync error:", response.message);
        if (response.message === i18n.getMessage("download_cloud_no_data")) {
          alert(response.message);
        } else {
          alert(i18n.getMessage("download_cloud_failure"));
        }
      }
    }
  );
}

function uploadCloud() {
  chrome.runtime.sendMessage({type: "uploadCloud"},
    function (status) {
      if (status.success) {
        alert(i18n.getMessage("upload_cloud_success"));
      } else {
        console.error("Cloud sync error:", status.message);
        alert(i18n.getMessage("upload_cloud_failure"));
      }
    }
  );
}

/**
 * Export the user's data, including their list of trackers from
 * action_map and snitch_map, along with their settings.
 * List will be in JSON format that can be edited and reimported
 * in another instance of Privacy Badger.
 */
function exportUserData() {
  chrome.storage.local.get(USER_DATA_EXPORT_KEYS, function (maps) {
    // append the formatted date to the exported file name
    let escaped_date = (new Date().toLocaleString())
      // illegal filename charset regex from
      // https://github.com/parshap/node-sanitize-filename/blob/ef1e8ad58e95eb90f8a01f209edf55cd4176e9c8/index.js
      .replace(/[\/\?<>\\:\*\|"]/g, '_') /* eslint no-useless-escape:off */
      // also collapse-replace commas and spaces
      .replace(/[, ]+/g, '_');
    let filename = 'PrivacyBadger_user_data-' + escaped_date + '.json';

    let link = document.createElement('a'),
      blob = new Blob([JSON.stringify(maps)], { type: 'application/json' });
    link.setAttribute('download', filename || '');
    link.href = URL.createObjectURL(blob);
    link.dispatchEvent(new MouseEvent('click'));
    URL.revokeObjectURL(blob);
  });
}

/**
 * Update setting for whether or not to show counter on Privacy Badger badge.
 */
function updateShowCounter() {
  const showCounter = $("#show_counter_checkbox").prop("checked");

  chrome.runtime.sendMessage({
    type: "updateSettings",
    data: { showCounter }
  }, () => {
    // Refresh display for each tab's PB badge.
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.runtime.sendMessage({
          type: "updateBadge",
          tab_id: tab.id
        });
      });
    });
  });
}

/**
 * Update DNT checkbox clicked
 */
function updateDNTCheckboxClicked() {
  const enabled = $("#enable_dnt_checkbox").prop("checked");

  chrome.runtime.sendMessage({
    type: "updateSettings",
    data: {
      sendDNTSignal: enabled
    }
  });

  $("#check_dnt_policy_checkbox").prop("checked", enabled).prop("disabled", !enabled);
  updateCheckingDNTPolicy();
}

function updateCheckingDNTPolicy() {
  const enabled = $("#check_dnt_policy_checkbox").prop("checked");

  chrome.runtime.sendMessage({
    type: "updateSettings",
    data: {
      checkForDNTPolicy: enabled
    }
  }, function () {
    chrome.runtime.sendMessage({
      type: "getOptionsData",
    }, (response) => {
      // update DNT-compliant domains
      updateSliders(response.trackers);
      // update cached domain data
      OPTIONS_DATA.trackers = response.trackers;
      // update count of blocked domains
      updateSummary();
      // toggle the "dnt" filter
      if (!enabled && $('#tracking-domains-type-filter').val() == "dnt") {
        $('#tracking-domains-type-filter').val("");
      }
      $('#tracking-domains-type-filter option[value="dnt"]').toggle(enabled);
    });
  });
}

function hideDisabledSitesTip(skip_anim) {
  $("#collapse-tip").hide();
  $("#expand-tip").show();
  if (skip_anim) {
    $("#tip-expanded").hide();
  } else {
    $("#tip-expanded").slideUp();
  }
  $("#tip-header").attr("aria-expanded", "false");
}

function showDisabledSitesTip() {
  $("#collapse-tip").show();
  $("#expand-tip").hide();
  $("#tip-expanded").slideDown();
  $("#tip-header").attr("aria-expanded", "true");
}

function reloadDisabledSites() {
  // Remember the state of the tip box
  if (!OPTIONS_DATA.settings.showDisabledSitesTip) {
    hideDisabledSitesTip(true);
  }
  // Switch the instructional graphic for Opera
  if (window.navigator.userAgent.match(/OPR\//)) {
    $('#disable-instructions-image').attr("src", "images/disable-instructions-opera.png");
  }

  $('#disable-instructions-image').attr("alt", i18n.getMessage("options_disable_tip_alt",
    [i18n.getMessage("popup_disable_for_site")]));

  let sites = OPTIONS_DATA.settings.disabledSites,
    $select = $('#allowlist-select');

  // sort disabled sites the same way blocked sites are sorted
  sites = htmlUtils.sortDomains(sites);

  $select.empty();
  for (let i = 0; i < sites.length; i++) {
    $('<option>').text(sites[i]).appendTo($select);
  }
}

function addDisabledSite(event) {
  event.preventDefault();

  let domain = utils.getHostFromDomainInput(
    document.getElementById("new-disabled-site-input").value.replace(/\s/g, "")
  );

  if (!domain) {
    return alert(i18n.getMessage("invalid_domain"));
  }

  chrome.runtime.sendMessage({
    type: "disableOnSite",
    domain
  }, (response) => {
    OPTIONS_DATA.settings.disabledSites = response.disabledSites;
    reloadDisabledSites();
    document.getElementById("new-disabled-site-input").value = "";
  });
}

function removeDisabledSite(event) {
  event.preventDefault();

  let domains = [];
  let $selected = $("#allowlist-select option:selected");
  for (let i = 0; i < $selected.length; i++) {
    domains.push($selected[i].text);
  }

  chrome.runtime.sendMessage({
    type: "reenableOnSites",
    domains
  }, (response) => {
    OPTIONS_DATA.settings.disabledSites = response.disabledSites;
    reloadDisabledSites();
  });
}

/**
 * Click handler for showing/hiding the disable site button tip
 */
function toggleDisabledSitesTip() {
  if ($("#expand-tip").is(":visible")) {
    showDisabledSitesTip();
    chrome.runtime.sendMessage({
      type: "updateSettings",
      data: { showDisabledSitesTip: true }
    });
  } else {
    hideDisabledSitesTip();
    chrome.runtime.sendMessage({
      type: "updateSettings",
      data: { showDisabledSitesTip: false }
    });
  }
}

/**
 * Updates the Site Exceptions form on the Widget Replacement tab.
 */
function reloadWidgetSiteExceptions() {
  let sites = Object.keys(OPTIONS_DATA.settings.widgetSiteAllowlist || {}),
    $select = $('#widget-site-exceptions-select');

  // sort widget exemptions sites the same way other options page domains lists are
  sites = htmlUtils.sortDomains(sites);

  $select.empty();
  for (let domain of sites) {
    // list allowed widget types alongside the domain they belong to
    let display_text = domain + " (" + OPTIONS_DATA.settings.widgetSiteAllowlist[domain].join(', ') + ")";
    $('<option>').text(display_text).val(domain).appendTo($select);
  }
}

function removeWidgetSiteExceptions(event) {
  event.preventDefault();

  chrome.runtime.sendMessage({
    type: "removeWidgetSiteExceptions",
    domains: $("#widget-site-exceptions-select").val()
  }, (response) => {
    OPTIONS_DATA.settings.widgetSiteAllowlist = response.widgetSiteAllowlist;
    reloadWidgetSiteExceptions();
  });
}

// Tracking Domains slider functions

/**
 * Gets action for given domain.
 * @param {String} domain - Domain to get action for.
 */
function getOriginAction(domain) {
  return OPTIONS_DATA.trackers[domain];
}

function revertDomainControl(event) {
  event.preventDefault();

  let domain = $(event.target).parent().data('origin');

  chrome.runtime.sendMessage({
    type: "revertDomainControl",
    domain
  }, (response) => {
    // update any sliders that changed as a result
    updateSliders(response.trackers);
    // update cached domain data
    OPTIONS_DATA.trackers = response.trackers;
  });
}

/**
 * Displays list of all tracking domains along with toggle controls.
 */
function updateSummary() {
  // if there are no tracking domains
  let allTrackingDomains = Object.keys(OPTIONS_DATA.trackers);
  if (!allTrackingDomains || !allTrackingDomains.length) {
    // hide the number of trackers message
    $("#options_domain_list_trackers").hide();

    // show "no trackers" message
    $("#options_domain_list_no_trackers").show();
    $("#tracking-domains-div").hide();

    // activate tooltips
    $('.tooltip:not(.tooltipstered)').tooltipster(TOOLTIP_CONF);

    return;
  }

  // reloadTrackingDomainsTab can be called multiple times, needs to be reversible
  $("#options_domain_list_no_trackers").hide();
  $("#tracking-domains-div").show();

  // count unique (cookie)blocked tracking base domains
  let blockedBases = new Set(
    filterDomains(OPTIONS_DATA.trackers, { typeFilter: '-dnt' })
      .map(d => getBaseDomain(d)));
  $("#options_domain_list_trackers").html(i18n.getMessage(
    "options_domain_list_trackers", [
      blockedBases.size,
      "<a target='_blank' title='" + htmlUtils.escape(i18n.getMessage("what_is_a_tracker")) + "' class='tooltip' href='https://privacybadger.org/#What-is-a-third-party-tracker'>"
    ]
  )).show();
}

/**
 * Displays list of all tracking domains along with toggle controls.
 */
function reloadTrackingDomainsTab() {
  updateSummary();

  // activate tooltips
  $('.tooltip:not(.tooltipstered)').tooltipster(TOOLTIP_CONF);

  // reloading the page should reapply search filters
  let searchFilters = sessionStorage.getItem('domain-list-filters');
  if (searchFilters) {
    for (let filter of JSON.parse(searchFilters)) {
      if (filter.type == 'checkbox') {
        $(filter.sel).prop('checked', filter.val);
      } else {
        $(filter.sel).val(filter.val);
      }
    }
  }

  filterTrackingDomains();
}

/**
 * Handles tracking domain list filter changes,
 * and calls the tracking domain list renderer.
 */
let filterTrackingDomains = (function () {
  let seedBases = new Set(),
    seedNotYetBlocked = new Set();

  function _maybeFetchSeed(skip, cb) {
    // only fetch when necessary:
    // hideInSeed is set and seed is not already loaded
    if (skip || seedBases.size) {
      return setTimeout(cb, 0);
    }

    utils.fetchResource(constants.SEED_DATA_LOCAL_URL, function (_, response) {
      let seedActions;

      try {
        seedActions = JSON.parse(response).action_map;
      } catch (e) {
        return cb();
      }

      for (let domain of Object.keys(seedActions)) {
        let base = getBaseDomain(domain);
        seedBases.add(base);
        if (utils.hasOwn(seedActions, base) && seedActions[base] == constants.ALLOW) {
          seedNotYetBlocked.add(base);
        }
      }

      // also add widget and Panopticlick domains
      for (let domain of OPTIONS_DATA.widgetDomains) {
        seedBases.add(getBaseDomain(domain));
      }
      for (let domain of constants.PANOPTICLICK_DOMAINS) {
        seedBases.add(getBaseDomain(domain));
      }

      cb();
    });
  }

  return function () {
    const $searchFilter = $('#trackingDomainSearch'),
      $typeFilter = $('#tracking-domains-type-filter'),
      $statusFilter = $('#tracking-domains-status-filter'),
      show_not_yet_blocked = $('#tracking-domains-show-not-yet-blocked').prop('checked'),
      hide_in_seed = $('#tracking-domains-hide-in-seed').prop('checked');

    if ($typeFilter.val() == "dnt") {
      $statusFilter.prop("disabled", true).val("");
    } else {
      $statusFilter.prop("disabled", false);
    }

    // reloading the page should reapply search filters
    sessionStorage.setItem('domain-list-filters', JSON.stringify([
      {
        sel: '#trackingDomainSearch',
        val: $searchFilter.val()
      }, {
        sel: '#tracking-domains-status-filter',
        val: $statusFilter.val()
      }, {
        sel: '#tracking-domains-type-filter',
        val: $typeFilter.val()
      }, {
        sel: '#tracking-domains-show-not-yet-blocked',
        val: show_not_yet_blocked,
        type: 'checkbox'
      }, {
        sel: '#tracking-domains-hide-in-seed',
        val: hide_in_seed,
        type: 'checkbox'
      },
    ]));

    let callback = function () {};
    if (this == $searchFilter[0]) {
      callback = function () {
        $searchFilter.focus();
      };
    }

    _maybeFetchSeed(!hide_in_seed, function () {
      renderTrackingDomains(
        filterDomains(OPTIONS_DATA.trackers, {
          searchFilter: $searchFilter.val().toLowerCase(),
          typeFilter: $typeFilter.val(),
          statusFilter: $statusFilter.val(),
          showNotYetBlocked: show_not_yet_blocked,
          hideInSeed: hide_in_seed,
          seedBases,
          seedNotYetBlocked
        }),
        callback);
    });
  };
}());

/**
 * Renders the list of tracking domains.
 *
 * @param {Array} domains
 * @param {Function} [cb] callback
 */
function renderTrackingDomains(domains, cb) {
  if (!cb) {
    cb = function () {};
  }

  window.SLIDERS_DONE = false;
  $('#tracking-domains-filters').hide();
  $('#blockedResources').hide();
  $('#tracking-domains-loader').show();

  domains = htmlUtils.sortDomains(domains);

  let out = [];
  for (let domain of domains) {
    let action = getOriginAction(domain);
    if (action) {
      let show_breakage_warning = (
        action == constants.USER_BLOCK &&
        utils.hasOwn(OPTIONS_DATA.cookieblocked, domain)
      );
      out.push(htmlUtils.getOriginHtml(domain, action, show_breakage_warning));
    }
  }

  function _renderChunk() {
    const CHUNK = 100;

    let $printable = $(out.splice(0, CHUNK).join(""));

    $printable.appendTo('#blockedResourcesInner');

    if (out.length) {
      requestAnimationFrame(_renderChunk);
    } else {
      $('#tracking-domains-loader').hide();
      $('#tracking-domains-filters').show();
      $('#blockedResources').show();

      if ($('#blockedResourcesInner').is(':visible')) {
        activateDomainListTooltips();
      }

      window.SLIDERS_DONE = true;
      cb();
    }
  }

  $('#blockedResourcesInner').empty();

  if (out.length) {
    requestAnimationFrame(_renderChunk);
  } else {
    $('#tracking-domains-loader').hide();
    $('#tracking-domains-filters').show();
    window.SLIDERS_DONE = true;
    cb();
  }
}

/**
 * Activates fancy tooltips for each visible row
 * in the list of tracking domains.
 *
 * The tooltips over domain names are constructed dynamically
 * for fetching and showing extra information
 * that wasn't prefetched on options page load.
 */
function activateDomainListTooltips() {
  let container = document.getElementById('blockedResourcesInner');

  // keep not-yet-tooltipstered, visible in scroll container elements only
  let $rows = $('#blockedResourcesInner div.clicker').filter((_, el) => {
    if (htmlUtils.isScrolledIntoView(el, container)) {
      if (el.querySelector('.tooltipstered')) {
        return false;
      }
      return el;
    }
    return false;
  });

  $rows.find('.origin-inner.tooltip').tooltipster({
    functionBefore: function (tooltip, ev) {
      let $domainEl = $(ev.origin).parents('.clicker').first();
      if ($domainEl.data('tooltip-fetched')) {
        return;
      }
      tooltip.content($('<span class="ui-icon ui-icon-loading-status-circle rotate"></span>'));
      chrome.runtime.sendMessage({
        type: "getOptionsDomainTooltip",
        domain: $domainEl.data('origin')
      }, function (response) {
        if (!response || !response.base || !response.snitchMap) {
          tooltip.content($domainEl.data('origin'));
          $domainEl.data('tooltip-fetched', '1');
          return;
        }
        let $tip = $("<span>" +
          i18n.getMessage('options_domain_list_sites', [response.base]) +
          "<ul><li>" +
          response.snitchMap.sort().map(site => {
            if (response.trackingMap && utils.hasOwn(response.trackingMap, site)) {
              if (response.trackingMap[site].includes("canvas")) {
                site += ` (${i18n.getMessage('canvas_fingerprinting')})`;
              }
            }
            return site;
          }).join("</li><li>") +
          "</li></ul>" +
          i18n.getMessage('learn_more_link', ['<a target=_blank href="https://privacybadger.org/#How-does-Privacy-Badger-work">privacybadger.org</a>']) +
          "</span>");
        tooltip.content($tip);
        $domainEl.data('tooltip-fetched', '1');
      });
    },
    interactive: true,
    theme: 'tooltipster-badger-domain-more-info',
    trigger: 'click',
    updateAnimation: false
  });

  $rows.find('.breakage-warning.tooltip').tooltipster();
  $rows.find('.switch-toggle > label.tooltip').tooltipster();
  $rows.find('.honeybadgerPowered.tooltip').tooltipster();
}

/**
 * Updates privacy overrides in Badger storage and in browser settings.
 */
function updatePrivacyOverride(setting_name, setting_value) {
  // update Badger settings
  chrome.runtime.sendMessage({
    type: "updateSettings",
    data: {
      [setting_name]: setting_value
    }
  }, () => {
    // update the underlying browser setting
    chrome.runtime.sendMessage({
      type: "setPrivacyOverrides"
    });
  });
}

/**
 * Updates domain tooltip, slider color.
 * Also toggles status indicators like breakage warnings.
 */
function updateOrigin(domain, action, userset) {
  let $clicker = $('#blockedResourcesInner div.clicker[data-origin="' + domain + '"]'),
    $switchContainer = $clicker.find('.switch-container').first();

  // update slider color via CSS
  $switchContainer.removeClass([
    constants.BLOCK,
    constants.COOKIEBLOCK,
    constants.ALLOW,
    constants.NO_TRACKING].join(" ")).addClass(action);

  // update EFF's Do Not Track policy compliance declaration icon
  if (action == constants.DNT) {
    // create or, if previously created, show DNT icon
    let $dntIcon = $clicker.find('div.dnt-compliant');
    if ($dntIcon.length) {
      $dntIcon.show();
    } else {
      let $domainName = $clicker.find('span.origin-inner');
      $domainName.html(htmlUtils.getDntIconHtml() + $domainName.html());
    }
  } else {
    // hide DNT icon if visible
    $clicker.find('div.dnt-compliant').hide();
  }

  let show_breakage_warning = (
    action == constants.BLOCK &&
    utils.hasOwn(OPTIONS_DATA.cookieblocked, domain)
  );

  htmlUtils.toggleBlockedStatus($clicker, userset, show_breakage_warning);
}

/**
 * Updates the list of tracking domains in response to user actions.
 *
 * For example, moving the slider for example.com should move the sliders
 * for www.example.com and cdn.example.com
 */
function updateSliders(updatedTrackerData) {
  let updated_domains = Object.keys(updatedTrackerData);

  // update any sliders that changed
  for (let domain of updated_domains) {
    let action = updatedTrackerData[domain];
    if (action == OPTIONS_DATA.trackers[domain]) {
      continue;
    }

    let userset = false;
    if (action.startsWith('user')) {
      userset = true;
      action = action.slice(5);
    }

    // update slider position
    let $radios = $('#blockedResourcesInner div.clicker[data-origin="' + domain + '"] input'),
      selected_val = (action == constants.DNT ? constants.ALLOW : action);
    // update the radio group without triggering a change event
    // https://stackoverflow.com/a/22635728
    $radios.val([selected_val]);

    // update domain slider row tooltip/status indicators
    updateOrigin(domain, action, userset);
  }

  // remove sliders that are no longer present
  let removed = Object.keys(OPTIONS_DATA.trackers).filter(
    x => !updated_domains.includes(x));
  for (let domain of removed) {
    let $clicker = $('#blockedResourcesInner div.clicker[data-origin="' + domain + '"]');
    $clicker.remove();
  }
}

/**
 * Save the user setting for a domain by messaging the background page.
 */
function saveToggle(domain, action) {
  chrome.runtime.sendMessage({
    type: "saveOptionsToggle",
    domain,
    action
  }, (response) => {
    // first update the cache for the slider
    // that was just changed by the user
    // to avoid redundantly updating it below
    OPTIONS_DATA.trackers[domain] = response.trackers[domain];
    // update any sliders that changed as a result
    updateSliders(response.trackers);
    // update cached domain data
    OPTIONS_DATA.trackers = response.trackers;
  });
}

/**
 * Remove domain from Privacy Badger.
 * @param {Event} event Click event triggered by user.
 */
function removeDomain(event) {
  event.preventDefault();

  // confirm removal before proceeding
  if (!confirm(i18n.getMessage("options_remove_origin_confirm"))) {
    return;
  }

  let domain = $(event.target).parent().data('origin');

  chrome.runtime.sendMessage({
    type: "removeDomain",
    domain
  }, (response) => {
    // remove rows that are no longer here
    updateSliders(response.trackers);
    // update cached domain data
    OPTIONS_DATA.trackers = response.trackers;
    // if we removed domains, the summary text may have changed
    updateSummary();
    // and we probably now have new visible rows in the tracking domains list
    activateDomainListTooltips();
  });
}

/**
 * Update which widgets should not get replaced
 */
function updateWidgetReplacementExceptions() {
  const widgetReplacementExceptions = $('#hide-widgets-select').select2('data').map(({ id }) => id);
  chrome.runtime.sendMessage({
    type: "updateSettings",
    data: { widgetReplacementExceptions }
  });
}

$(function () {
  $.tooltipster.setDefaults(htmlUtils.TOOLTIPSTER_DEFAULTS);

  function getOptionsData() {
    chrome.runtime.sendMessage({
      type: "getOptionsData",
    }, (response) => {
      OPTIONS_DATA = response;
      loadOptions();
    });
  }

  getOptionsData();
});
