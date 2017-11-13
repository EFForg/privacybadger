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

// TODO: This code is a hideous mess and desperately needs to be refactored and cleaned up.

const USER_DATA_EXPORT_KEYS = ["action_map", "snitch_map", "settings_map"];

/**
 * TODO
 * @cooperq - 2016/12/05
 * This is a workaround for a bug in firefox 50.0.2 (no bugzilla id I could find)
 * This bug is fixed as of firefox 52.0 and the try/catch can be removed at that
 * time
 **/
try {
  var backgroundPage = chrome.extension.getBackgroundPage();
} catch (e) {
  location.reload();
}
var require = backgroundPage.require;
var badger = backgroundPage.badger;
var log = backgroundPage.log;
var constants = backgroundPage.constants;
var htmlUtils = require("htmlutils").htmlUtils;
var i18n = chrome.i18n;
var originCache = null;
var settings = badger.storage.getBadgerStorageObject("settings_map");

let migrations = require("migrations").Migrations;

/*
 * Loads options from pb storage and sets UI elements accordingly.
 */
function loadOptions() {
  $('#blockedResources').css('max-height',$(window).height() - 300);

  // Set page title to i18n version of "Privacy Badger Options"
  document.title = i18n.getMessage("options_title");

  // Add event listeners
  $("#whitelistForm").submit(addWhitelistDomain);
  $("#removeWhitelist").click(removeWhitelistDomain);
  $('#importTrackerButton').click(loadFileChooser);
  $('#importTrackers').change(importTrackerList);
  $('#exportTrackers').click(exportUserData);

  // Set up input for searching through tracking domains.
  $("#trackingDomainSearch").on("input", filterTrackingDomains);

  // Add event listeners for origins container.
  $(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
    $('#blockedResourcesContainer').on('click', '.removeOrigin', removeOrigin);
  });

  // Display jQuery UI elements
  $("#tabs").tabs({
    activate: function (event, ui) {
      // update options page URL fragment identifier
      // to preserve selected tab on page reload
      window.location.hash = ui.newPanel.attr('id');
    }
  });
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});
  $(".importButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".exportButton").button("option", "icons", {primary: "ui-icon-extlink"});
  $("#show_counter_checkbox").click(updateShowCounter);
  $("#show_counter_checkbox").prop("checked", badger.showCounter());
  $("#replace_social_widgets_checkbox").click(updateSocialWidgetReplacement);
  $("#replace_social_widgets_checkbox").prop("checked", badger.isSocialWidgetReplacementEnabled());
  $("#check_dnt_policy_checkbox").click(updateCheckingDNTPolicy);
  $("#check_dnt_policy_checkbox").prop("checked", badger.isCheckingDNTPolicyEnabled());

  if (badger.webRTCAvailable) {
    $("#toggle_webrtc_mode").click(toggleWebRTCIPProtection);
    $("#toggle_webrtc_mode").prop("checked", badger.isWebRTCIPProtectionEnabled());
  } else {
    // Hide WebRTC-related settings for non-supporting browsers
    $("#webRTCToggle").css({"visibility": "hidden", "height": 0});
    $("#settingsSuffix").css({"visibility": "hidden", "height": 0});
  }

  // Show user's filters
  reloadWhitelist();
  refreshFilterPage();
}
$(loadOptions);

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
    var selectFile = i18n.getMessage("import_select_file");
    confirm(selectFile);
  }

  document.getElementById("importTrackers").value = '';
}

/**
 * Parse the tracker lists uploaded by the user, adding to the
 * storage maps anything that isn't currently present.
 *
 * @param {string} storageMapsList Data from JSON file that user provided
 */
function parseUserDataFile(storageMapsList) {
  var lists;

  try {
    lists = JSON.parse(storageMapsList);
  } catch (e) {
    return confirm(i18n.getMessage("invalid_json"));
  }

  // validate by checking we have the same keys in the import as in the export
  if (!_.isEqual(
    Object.keys(lists).sort(),
    USER_DATA_EXPORT_KEYS.sort()
  )) {
    return confirm(i18n.getMessage("invalid_json"));
  }

  for (let map in lists) {
    var storageMap = badger.storage.getBadgerStorageObject(map);

    if (storageMap) {
      storageMap.merge(lists[map]);
    }
  }

  // fix yellowlist getting out of sync
  migrations.reapplyYellowlist(badger);

  // Update list to reflect new status of map
  reloadWhitelist();
  refreshFilterPage();
  var importSuccessful = i18n.getMessage("import_successful");
  confirm(importSuccessful);
}

/**
 * Export the user's data, including their list of trackers from
 * action_map and snitch_map, along with their settings.
 * List will be in JSON format that can be edited and reimported
 * in another instance of Privacy Badger.
 */
function exportUserData() {
  chrome.storage.local.get(USER_DATA_EXPORT_KEYS, function (maps) {

    var mapJSON = JSON.stringify(maps);

    // Append the formatted date to the exported file name
    var currDate = new Date().toLocaleString();
    var escapedDate = currDate
      // illegal filename charset regex from
      // https://github.com/parshap/node-sanitize-filename/blob/ef1e8ad58e95eb90f8a01f209edf55cd4176e9c8/index.js
      .replace(/[\/\?<>\\:\*\|":]/g, '_') /* eslint no-useless-escape:off */
      // also collapse-replace commas and spaces
      .replace(/[, ]+/g, '_');
    var filename = 'PrivacyBadger_user_data-' + escapedDate + '.json';

    // Download workaround taken from uBlock Origin
    // https://github.com/gorhill/uBlock/blob/40a85f8c04840ae5f5875c1e8b5fa17578c5bd1a/platform/chromium/vapi-common.js
    var a = document.createElement('a');
    a.setAttribute('download', filename || '');

    // TODO remove browser check and simplify code once Firefox 52 goes away
    // https://github.com/EFForg/privacybadger/pull/1532#issuecomment-318702372
    if (chrome.runtime.getBrowserInfo) {
      chrome.runtime.getBrowserInfo((info) => {
        if (info.name == "Firefox") {
          a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(mapJSON);
          a.dispatchEvent(new MouseEvent('click'));
        } else {
          var blob = new Blob([mapJSON], {type: 'application/json'}); // pass a useful mime type here
          a.href = URL.createObjectURL(blob);
          a.dispatchEvent(new MouseEvent('click'));
          URL.revokeObjectURL(blob);
        }
      });
    } else {
      var blob = new Blob([mapJSON], {type: 'application/json'}); // pass a useful mime type here
      a.href = URL.createObjectURL(blob);
      a.dispatchEvent(new MouseEvent('click'));
      URL.revokeObjectURL(blob);
    }
  });
}

/**
 * Update setting for whether or not to show counter on Privacy Badger badge.
 */
function updateShowCounter() {
  var showCounter = $("#show_counter_checkbox").prop("checked");
  settings.setItem("showCounter", showCounter);

  // Refresh display for each tab's PB badge.
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      badger.updateBadge(tab.id);
    });
  });
}

/**
 * Update setting for whether or not to replace social widgets.
 */
function updateSocialWidgetReplacement() {
  var replaceSocialWidgets = $("#replace_social_widgets_checkbox").prop("checked");
  settings.setItem("socialWidgetReplacementEnabled", replaceSocialWidgets);
}

function updateCheckingDNTPolicy() {
  var newDNTSetting = $("#check_dnt_policy_checkbox").prop("checked");
  settings.setItem("checkForDNTPolicy", newDNTSetting);
  refreshFilterPage(); // This setting means sites need to be re-evaluated
}

function reloadWhitelist() {
  var sites = settings.getItem("disabledSites");
  var sitesList = $('#excludedDomainsBox');
  // Sort the white listed sites in the same way the blocked sites are
  sites.sort(htmlUtils.compareReversedDomains);
  sitesList.html("");
  for (var i = 0; i < sites.length; i++) {
    $('<option>').text(sites[i]).appendTo(sitesList);
  }
}

/**
 * Refreshes cached origins.
 */
function refreshOriginCache() {
  originCache = getOrigins();
}

/**
 * Gets array of encountered origins.
 * @param filterText {String} Text to filter origins with.
 * @return {Array}
 */
function getOriginsArray(filterText) {
  // Make sure filterText is lower case for case-insensitive matching.
  if (filterText) {
    filterText = filterText.toLowerCase();
  } else {
    filterText = "";
  }

  // Include only origins containing given filter text.
  function containsFilterText(origin) {
    return origin.toLowerCase().indexOf(filterText) !== -1;
  }
  return Object.keys(originCache).filter(containsFilterText);
}

function addWhitelistDomain(event) {
  event.preventDefault();

  var domain = backgroundPage.utils.getHostFromDomainInput(
    document.getElementById("newWhitelistDomain").value.replace(/\s/g, "")
  );

  if (!domain) {
    return confirm(i18n.getMessage("invalid_domain"));
  }

  badger.disablePrivacyBadgerForOrigin(domain);

  reloadWhitelist();
  document.getElementById("newWhitelistDomain").value = "";
}

function removeWhitelistDomain(event) {
  event.preventDefault();
  var selected = $(document.getElementById("excludedDomainsBox")).find('option:selected');
  for (var i = 0; i < selected.length; i++) {
    badger.enablePrivacyBadgerForOrigin(selected[i].text);
  }
  reloadWhitelist();
}

// filter slider functions

/**
 * Gets all encountered origins with associated actions.
 * @return {Object}
 */
function getOrigins() {
  var origins = {};
  var action_map = badger.storage.getBadgerStorageObject('action_map');
  for (var domain in action_map.getItemClones()) {
    var action = badger.storage.getBestAction(domain);
    // Do not show non tracking origins
    if (action != constants.NO_TRACKING) {
      origins[domain] = action;
    }
  }
  return origins;
}

/**
 * Gets action for given origin.
 * @param origin Origin to get action for.
 */
function getOriginAction(origin) {
  // Check to see if cached origins need to be set.
  if (! originCache) {
    refreshOriginCache();
  }

  return originCache[origin];
}

//TODO unduplicate this code? since it's also in popup
function revertDomainControl(e) {
  var $elm = $(e.target).parent();
  log('revert to privacy badger control for', $elm);
  var origin = $elm.data('origin');
  badger.storage.revertUserAction(origin);
  var defaultAction = badger.storage.getBestAction(origin);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector = $(selectorId);
  log('selector', selector);
  selector.click();
  $elm.removeClass('userset');
  refreshFilterPage(origin);
  return false;
}

/**
 * Displays list of all tracking domains along with toggle controls.
 */
function refreshFilterPage() {
  refreshOriginCache();

  // Check to see if any tracking domains have been found before continuing.
  var allTrackingDomains = getOriginsArray();
  if (!allTrackingDomains || allTrackingDomains.length === 0) {
    $("#count").text(0);
    $("#blockedResources").html("Could not detect any tracking cookies.");

    // activate tooltips
    $('.tooltip').tooltipster();

    return;
  }

  // Update tracking domain count.
  $("#count").text(allTrackingDomains.length);

  // Get containing HTML for domain list along with toggle legend icons.
  $("#blockedResources")[0].innerHTML = htmlUtils.getTrackerContainerHtml();

  // activate tooltips
  $('.tooltip').tooltipster();

  // Display tracking domains.
  var originsToDisplay;
  var searchText = $("#trackingDomainSearch").val();
  if (searchText.length > 0) {
    originsToDisplay = getOriginsArray(searchText);
  } else {
    originsToDisplay = allTrackingDomains;
  }
  showTrackingDomains(originsToDisplay);

  log("Done refreshing options page");
}

/**
 * Displays filtered list of tracking domains based on user input.
 * @param event Input event triggered by user.
 */
function filterTrackingDomains(/*event*/) {
  var initialSearchText = $('#trackingDomainSearch').val().toLowerCase();

  // Wait a short period of time and see if search text has changed.
  // If so it means user is still typing so hold off on filtering.
  var timeToWait = 500;
  setTimeout(function() {
    // Check search text.
    var searchText = $('#trackingDomainSearch').val().toLowerCase();
    if (searchText !== initialSearchText) {
      return;
    }

    // Show filtered origins.
    var filteredOrigins = getOriginsArray(searchText);
    showTrackingDomains(filteredOrigins);
  }, timeToWait);
}

/**
 * Add origins to the blocked resources list on scroll.
 *
*/
function addOrigins(e) {
  var domains = e.data;
  var target = e.target;
  var totalHeight = target.scrollHeight - target.clientHeight;
  if ((totalHeight - target.scrollTop) < 400) {
    var domain = domains.shift();
    var action = getOriginAction(domain);
    if (action) {
      $(target).append(htmlUtils.getOriginHtml(domain, action, action == constants.DNT));
    }
  }

  // activate tooltips
  $('#blockedResourcesInner .tooltip:not(.tooltipstered)').tooltipster(
    htmlUtils.DOMAIN_TOOLTIP_CONF);
}

/**
 * Displays list of tracking domains along with toggle controls.
 * @param domains Tracking domains to display.
 */
function showTrackingDomains(domains) {
  domains.sort(htmlUtils.compareReversedDomains);

  // Create HTML for list of tracking domains.
  var trackingDetails = '';
  for (var i = 0; (i < 50) && (domains.length > 0); i++) {
    var trackingDomain = domains.shift();
    // todo: gross hack, use templating framework
    var action = getOriginAction(trackingDomain);
    if (action) {
      trackingDetails += htmlUtils.getOriginHtml(trackingDomain, action, action == constants.DNT);
    }
  }

  // Display tracking domains.
  $('#blockedResourcesInner').html(trackingDetails);

  $('#blockedResourcesInner').off('scroll');
  $('#blockedResourcesInner').scroll(domains, addOrigins);

  // activate tooltips
  $('#blockedResourcesInner .tooltip:not(.tooltipstered)').tooltipster(
    htmlUtils.DOMAIN_TOOLTIP_CONF);

  // Register handlers for tracking domain toggle controls.
  $('.switch-toggle').each(function() {
    var radios = $(this).children('input');
    var value = $(this).children('input:checked').val();

    var slider = $('<div></div>').slider({
      min: 0,
      max: 2,
      value: value,
      create: function(/*event, ui*/) {
        $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
      },
      slide: function(event, ui) {
        radios.filter('[value=' + ui.value + ']').click();
      },
      stop: function(event, ui) {
        $(ui.handle).css('margin-left', -16 * ui.value + 'px');

        // Save change for origin.
        var origin = radios.filter('[value=' + ui.value + ']')[0].name;
        var setting = htmlUtils.getCurrentClass($(this).parents('.clicker'));
        syncSettings(origin, setting);
      },
    }).appendTo(this);

    radios.change(function() {
      slider.slider('value', radios.filter(':checked').val());
    });
  });
}

/**
 * https://tools.ietf.org/html/draft-ietf-rtcweb-ip-handling-01#page-5
 * (Chrome only)
 * Toggle WebRTC IP address leak protection setting. "False" value means
 * policy is set to Mode 3 (default_public_interface_only), whereas "true"
 * value means policy is set to Mode 4 (disable_non_proxied_udp).
 */
function toggleWebRTCIPProtection() {
  // Return early with non-supporting browsers
  if (!badger.webRTCAvailable) {
    return;
  }
  var cpn = chrome.privacy.network;

  cpn.webRTCIPHandlingPolicy.get({}, function(result) {
    var newVal;

    // Update new value to be opposite of current browser setting
    if (result.value === 'disable_non_proxied_udp') {
      newVal = 'default_public_interface_only';
    } else {
      newVal = 'disable_non_proxied_udp';
    }
    cpn.webRTCIPHandlingPolicy.set({value: newVal}, function() {
      settings.setItem("webRTCIPProtection", (newVal === 'disable_non_proxied_udp'));
    });
  });
}

function updateOrigin(event) {
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  log('updating origin for', $elm);
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var action = $elm.data('action');
  $switchContainer.removeClass([
    constants.BLOCK,
    constants.COOKIEBLOCK,
    constants.ALLOW,
    constants.NO_TRACKING].join(" ")).addClass(action);
  htmlUtils.toggleBlockedStatus($($clicker), action);

  // reinitialize the domain tooltip
  $clicker.find('.origin').tooltipster('destroy');
  $clicker.find('.origin').attr(
    'title',
    htmlUtils.getActionDescription(action, $clicker.data('origin'))
  );
  $clicker.find('.origin').tooltipster(htmlUtils.DOMAIN_TOOLTIP_CONF);
}

/**
 * Remove origin from Privacy Badger.
 * @param event {Event} Click event triggered by user.
 */
function removeOrigin(event) {
  // Confirm removal before proceeding.
  var removalConfirmed = confirm(i18n.getMessage("options_remove_origin_confirm"));
  if (!removalConfirmed) {
    return;
  }

  // Remove traces of origin from storage.
  var $element = $(event.target).parent();
  var origin = $element.data('origin');
  badger.storage.getBadgerStorageObject("snitch_map").deleteItem(origin);
  badger.storage.getBadgerStorageObject("action_map").deleteItem(origin);
  backgroundPage.log('Removed', origin, 'from Privacy Badger');

  refreshFilterPage();
}

/**
 * Syncs settings for origins changed by user.
 *
 * @param originToCheck {String} Origin to check for changes, optional. If null,
 *                               all origins are checked.
 */
function syncSettings(origin, userAction) {
  log("Syncing userset options: ", origin, userAction);

  // Save new action for updated origins.
  badger.saveAction(userAction, origin);
  log("Finished syncing.");

  // Options page needs to be refreshed to display current results.
  refreshFilterPage();
}
