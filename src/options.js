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

var backgroundPage = chrome.extension.getBackgroundPage();
var require = backgroundPage.require;
var pb = backgroundPage.pb; // incognito_pb can't use this page
var constants = backgroundPage.constants;
var htmlUtils = require("htmlutils").htmlUtils;
var i18n = chrome.i18n;
var originCache = null;
var settings = pb.storage.getBadgerStorageObject("settings_map");

var log = backgroundPage.log;
var getBadger = backgroundPage.getBadgerWithTab;

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

  // Set up input for searching through tracking domains.
  $("#trackingDomainSearch").attr("placeholder", i18n.getMessage("options_domain_search"));
  $("#trackingDomainSearch").on("input", filterTrackingDomains);

  // Add event listeners for origins container.
  $(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
    $('#blockedResourcesContainer').on('mouseenter', '.tooltip', displayTooltip);
    $('#blockedResourcesContainer').on('mouseleave', '.tooltip', hideTooltip);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
    $('#blockedResourcesContainer').on('click', '.removeOrigin', removeOrigin);
  });

  // Display jQuery UI elements
  $("#tabs").tabs();
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});
  $("#activate_socialwidget_btn").click(activateSocialWidgetReplacement);
  $("#deactivate_socialwidget_btn").click(deactivateSocialWidgetReplacement);
  if(!pb.isSocialWidgetReplacementEnabled()) {
    $("#activate_socialwidget_btn").show();
    $("#deactivate_socialwidget_btn").hide();
  }
  $("#toggle_counter_checkbox").click(toggleCounter);
  $("#toggle_counter_checkbox").prop("checked", pb.showCounter());

  // Show user's filters
  reloadWhitelist();
  refreshFilterPage();
}
$(loadOptions);

function activateSocialWidgetReplacement() {
  $("#activate_socialwidget_btn").toggle();
  $("#deactivate_socialwidget_btn").toggle();
  settings.setItem('socialWidgetReplacementEnabled', true);
}

function deactivateSocialWidgetReplacement() {
  $("#activate_socialwidget_btn").toggle();
  $("#deactivate_socialwidget_btn").toggle();
  settings.setItem('socialWidgetReplacementEnabled', false);
}

function toggleCounter() {
  if ($("#toggle_counter_checkbox").prop("checked")) {
    settings.setItem("showCounter", true);
  } else {
    settings.setItem("showCounter", false);
  }
  chrome.windows.getAll(null, function(windows) {
    windows.forEach(function(window) {
      chrome.tabs.getAllInWindow(window.id, function(tabs) {
        tabs.forEach(function(tab) {
          getBadger(tab.id).updateBadge(tab.id);
        });
      });
    });
  });
}

function reloadWhitelist() {
  var sites = settings.getItem("disabledSites");
  var sitesList = $('#excludedDomainsBox');
  sitesList.html("");
  for( var i = 0; i < sites.length; i++){
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

  var domain = document.getElementById("newWhitelistDomain").value.replace(/\s/g, "");
  document.getElementById("newWhitelistDomain").value = "";
  if (!domain) {
    return;
  }

  pb.disablePrivacyBadgerForOrigin(domain);
  reloadWhitelist();
}

function removeWhitelistDomain(event) {
  event.preventDefault();
  var selected = $(document.getElementById("excludedDomainsBox")).find('option:selected');
  for(var i = 0; i < selected.length; i++){
    pb.enablePrivacyBadgerForOrigin(selected[i].text);
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
  var action_map = pb.storage.getBadgerStorageObject('action_map');
  for (var domain in action_map.getItemClones()) {
    var action = pb.storage.getBestAction(domain);
    // Do not show non tracking origins
    if(action != constants.NO_TRACKING){
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
function revertDomainControl(e){
  var $elm = $(e.target).parent();
  log('revert to privacy badger control for', $elm);
  var origin = $elm.data('origin');
  pb.storage.revertUserAction(origin);
  var defaultAction = pb.storage.getBestAction(origin);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector =   $(selectorId);
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
    return;
  }

  // Update tracking domain count.
  $("#count").text(allTrackingDomains.length);

  // Display tracker tooltips.
  var trackerTooltips = '<div id="associatedTab" data-tab-id="000"></div>' +
    '<div class="keyContainer">'+
    '<div class="key">'+
    '<img class="tooltip" src="/icons/UI-icons-red.png" tooltip="Move the slider left to block a domain.">'+
    '<img class="tooltip" src="/icons/UI-icons-yellow.png" tooltip="Center the slider to block cookies.">'+
    '<img class="tooltip" src="/icons/UI-icons-green.png" tooltip="Move the slider right to allow a domain.">'+
    '<div class="tooltipContainer"></div>' +
    '</div></div>'+
    '<div class="spacer"></div>' +
    '<div id="blockedResourcesInner" class="clickerContainer"></div>';
  $("#blockedResources").html(trackerTooltips);

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
 * Displays list of tracking domains along with toggle controls.
 * @param domains Tracking domains to display.
 */
function showTrackingDomains(domains) {
  domains.sort(htmlUtils.compareReversedDomains);

  // Create HTML for list of tracking domains.
  var trackingDetails = '<div id="blockedResourcesInner" class="clickerContainer">';
  for (var i = 0; i < domains.length; i++) {
    var trackingDomain = domains[i];
    // todo: gross hack, use templating framework
    var action = getOriginAction(trackingDomain);
    if (action) {
      trackingDetails = htmlUtils.addOriginHtml(trackingDetails, trackingDomain, action);
    }
  }
  trackingDetails += '</div>';

  // Display tracking domains.
  $('#blockedResourcesInner').html(trackingDetails);
  $('.switch-toggle').each(function() { registerToggleHandlers(this); });
}

/**
 * Registers handlers for tracking domain toggle controls.
 * @param element HTML element containing toggle control.
 */
function registerToggleHandlers(element) {
  var radios = $(element).children('input');
  var value = $(element).children('input:checked').val();

  var slider = $('<div></div>').slider({
    min: 0,
    max: 2,
    value: value,
    create: function(/*event, ui*/) {
      $(element).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
    },
    slide: function(event, ui) {
      radios.filter('[value=' + ui.value + ']').click();
    },
    stop: function(event, ui) {
      $(ui.handle).css('margin-left', -16 * ui.value + 'px');

      // Save change for origin.
      var origin = radios.filter('[value=' + ui.value + ']')[0].name;
      var action = htmlUtils.getCurrentClass($(element).parents('.clicker'));
      syncSettings(origin, action);
    },
  }).appendTo(element);

  radios.change(function() {
    slider.slider('value', radios.filter(':checked').val());
  });
}

function updateOrigin(event){
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  log('updating origin for', $elm);
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var action = $elm.data('action');
  $switchContainer.removeClass([constants.BLOCK, constants.COOKIEBLOCK, constants.ALLOW, constants.NO_TRACKING].join(" ")).addClass(action);
  htmlUtils.toggleBlockedStatus($($clicker), action);
  var origin = $clicker.data('origin');
  $clicker.attr('tooltip', htmlUtils.getActionDescription(action, origin));
  $clicker.children('.tooltipContainer').html(htmlUtils.getActionDescription(action, origin));
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
  pb.storage.getBadgerStorageObject("snitch_map").deleteItem(origin);
  pb.storage.getBadgerStorageObject("action_map").deleteItem(origin);
  pb.storage.getBadgerStorageObject("supercookie_domains").deleteItem(origin);
  backgroundPage.log('Removed', origin, 'from Privacy Badger');

  refreshFilterPage();
}

var tooltipDelay = 300;

function displayTooltip(event){
  var $elm = $(event.currentTarget);
  var displayTipTimer = setTimeout(function(){
    if(!$elm.attr('tooltip').length){ return; }
    var $container = $elm.closest('.clicker').children('.tooltipContainer');
    if($container.length === 0){
      $container = $elm.siblings('.tooltipContainer');
    }
    $container.text($elm.attr('tooltip'));
    $container.show();
    $container.siblings('.tooltipArrow').show();
  },tooltipDelay);
  $elm.on('mouseleave', function(){clearTimeout(displayTipTimer);});
}

function hideTooltip(event){
  var $elm = $(event.currentTarget);
  var hideTipTimer = setTimeout(function(){
    var $container = $elm.closest('.clicker').children('.tooltipContainer');
    if($container.length === 0){
      $container = $elm.siblings('.tooltipContainer');
    }
    if($container.is(':hidden')){return;}
    $container.text('');
    $container.hide();
    $container.siblings('.tooltipArrow').hide();
  },tooltipDelay);
  $elm.on('mouseenter',function(){clearTimeout(hideTipTimer);});
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
  pb.saveAction(userAction, origin);
  log("Finished syncing.");

  // Options page needs to be refreshed to display current results.
  refreshFilterPage();
}
