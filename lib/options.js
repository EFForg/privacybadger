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

var backgroundPage = chrome.extension.getBackgroundPage();
var require = backgroundPage.require;
var imports = [
  "require", "saveAction", "removeFilter",
  "removeOriginFromPrivacyBadger", "updateBadge"
];
for (var i = 0; i < imports.length; i++){
      window[imports[i]] = backgroundPage[imports[i]];
}
var Utils = require("utils").Utils;
var htmlUtils = require("htmlutils").htmlUtils;
var filterWhitelist = {}

with(require("filterClasses"))
{
  this.Filter = Filter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.SpecialSubscription = SpecialSubscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var Prefs = require("prefs").Prefs;
var Synchronizer = require("synchronizer").Synchronizer;
var originCache = null;

/*
 * Loads options from localStorage and sets UI elements accordingly.
 */
function loadOptions() {
  $('#blockedResources').css('max-height',$(window).height() - 300);

  // Set page title to i18n version of "Privacy Badger Options"
  document.title = i18n.getMessage("options_title");

  // Add event listeners
  window.addEventListener("unload", unloadOptions, false);
  $("#whitelistForm").submit(addWhitelistDomain);
  $("#removeWhitelist").click(removeWhitelistDomain);
  FilterNotifier.addListener(onFilterChange);

  // Set up input for searching through tracking domains.
  $("#trackingDomainSearch").attr("placeholder", i18n.getMessage("options_domain_search"));
  $("#trackingDomainSearch").on("input", filterTrackingDomains);

  // load resources for filter sliders
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
  $("#activate_socialwidget_btn").click(active_socialwidget);
  $("#deactivate_socialwidget_btn").click(deactive_socialwidget);
  if(!Utils.isSocialWidgetReplacementEnabled()) {
    $("#activate_socialwidget_btn").show();
    $("#deactivate_socialwidget_btn").hide();
  }
  $("#toggle_counter_checkbox").click(toggle_counter)
   .prop("checked", Utils.showCounter());
  filterWhitelist = convertWhitelistToHash(FilterStorage.subscriptions[0].filters);

  // Show user's filters
  reloadWhitelist();
  refreshFilterPage();
}
$(loadOptions);

function active_socialwidget(){
  $("#activate_socialwidget_btn").toggle();
  $("#deactivate_socialwidget_btn").toggle();
  localStorage.socialWidgetReplacementEnabled = "true";
}

function deactive_socialwidget(){
  $("#activate_socialwidget_btn").toggle();
  $("#deactivate_socialwidget_btn").toggle();
  localStorage.socialWidgetReplacementEnabled = "false";
}

function toggle_counter(){
  if ($("#toggle_counter_checkbox").prop("checked")) {
    localStorage.showCounter = "true";
  } else {
    localStorage.showCounter = "false";
  }
  chrome.windows.getAll(null, function(windows) {
    windows.forEach(function(window) {
      chrome.tabs.getAllInWindow(window.id, function(tabs) {
        tabs.forEach(function(tab) {
          updateBadge(tab.id);
        });
      });
    });
  });
}

function convertWhitelistToHash(filters)
{
  out = {}
  for (var i = 0; i < filters.length; i++){
    out[filters[i].regexp.source] = 1;
  }
  return out
}

function reloadWhitelist()
{
  var sites = JSON.parse(localStorage.disabledSites || "[]");
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
 * @return {Array}
 */
function getOriginsArray() {
  var originsArray = [];
  for (var origin in originCache) {
    originsArray.push(origin);
  }
  return originsArray;
}

// Cleans up when the options window is closed
function unloadOptions()
{
  FilterNotifier.removeListener(onFilterChange);
}

function onFilterChange(action, item, param1, param2) {
  syncSettings();
}

function addWhitelistDomain(event)
{
  event.preventDefault();

  var domain = document.getElementById("newWhitelistDomain").value.replace(/\s/g, "");
  document.getElementById("newWhitelistDomain").value = "";
  if (!domain)
    return;

  Utils.disablePrivacyBadgerForOrigin(domain)
  reloadWhitelist()
}

function removeWhitelistDomain(event)
{
  var selected = $(document.getElementById("excludedDomainsBox")).find('option:selected');
  for(var i = 0; i < selected.length; i++){
    Utils.enablePrivacyBadgerForOrigin(selected[i].text);
  }
  reloadWhitelist();
}

// filter slider functions

/**
 * Gets all encountered origins with associated actions.
 * @return {Object}
 */
function getOrigins()
{
  origins = {};

  // Process origins allowed by user.
  var green = FilterStorage.knownSubscriptions.userGreen.filters;
  for (var i = 0; i < green.length; i++) {
    origins[green[i].regexp.source] = 'usernoaction';
  }

  // Process origins cookie-blocked by user.
  var yellow = FilterStorage.knownSubscriptions.userYellow.filters;
  for (var i = 0; i < yellow.length; i++) {
    origins[yellow[i].regexp.source] = 'usercookieblock';
  }

  // Process origins blocked by user.
  var red = FilterStorage.knownSubscriptions.userRed.filters;
  for (var i = 0; i < red.length; i++) {
    origins[red[i].regexp.source] = 'userblock';
  }

  // Process origins blocked/cookie-blocked by heuristic.
  var heuristics = FilterStorage.knownSubscriptions.frequencyHeuristic.filters;
  for (var i = 0; i < heuristics.length; i++){
    var origin = heuristics[i].regexp.source;
    if (origins[origin]) {
      continue;
    }
    if (filterWhitelist[origin]) {
      origins[origin] = 'cookieblock';
    } else {
      origins[origin] = 'block';
    }
  }

  // Process origins that have been seen but not blocked yet.
  var seen = Object.keys(backgroundPage.seenThirdParties);
  for (var i = 0; i < seen.length; i++) {
    var origin = seen[i];
    if (! origins[origin]) {
      origins[origin] = 'noaction';
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

  var action = originCache[origin];
  if (action) {
    return action;
  }
  return "noaction";
}

function revertDomainControl(e){
  $elm = $(e.target).parent();
  console.log('revert to privacy badger control for', $elm);
  var origin = $elm.data('origin');
  var original_action = $elm.data('original-action');
  var stores = {'block': 'userRed',
                'cookieblock': 'userYellow',
                'noaction': 'userGreen'};
  var filter = "||" + origin + "^$third-party";
  var store = stores[original_action];
  removeFilter(store,filter);
  var defaultAction = getOriginAction(origin);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector =   $(selectorId);
  console.log('selector', selector);
  selector.click();
  $elm.removeClass('userset');
  return false;
}

/**
 * Removes origin from Privacy Badger.
 *
 * @param event {Event} Click event triggered by user.
 */
function removeOrigin(event) {
  // Confirm removal before proceeding.
  var removalConfirmed = confirm(i18n.getMessage("remove_origin_confirmation"));
  if (! removalConfirmed) {
    return;
  }

  // Remove origin from Privacy Badger.
  var $element = $(event.target).parent();
  var origin = $element.data('origin');
  removeOriginFromPrivacyBadger(origin);

  refreshFilterPage();
}

function toggleEnabled() {
  console.log("Refreshing icon and context menu");
  refreshIconAndContextMenu(tab);
}

function toggleBlockedStatus(elt,status) {
  console.log('toggle blocked status', elt, status);
  if(status){
    $(elt).removeClass("block cookieblock noaction").addClass(status);
    $(elt).addClass("userset");
    return;
  }

  var originalAction = elt.getAttribute('data-original-action');
  if ($(elt).hasClass("block"))
    $(elt).toggleClass("block");
  else if ($(elt).hasClass("cookieblock")) {
    $(elt).toggleClass("block");
    $(elt).toggleClass("cookieblock");
  }
  else
    $(elt).toggleClass("cookieblock");
  if ($(elt).hasClass(originalAction) || (originalAction == 'noaction' && !($(elt).hasClass("block") ||
                                                                            $(elt).hasClass("cookieblock"))))
    $(elt).removeClass("userset");
  else
    $(elt).addClass("userset");
}

function compareReversedDomains(a, b){
  fqdn1 = makeSortable(a);
  fqdn2 = makeSortable(b);
  if(fqdn1 < fqdn2){
    return -1;
  }
  if(fqdn1 > fqdn2){
    return 1;
  }
  return 0;
}

function makeSortable(domain){
  var tmp = domain.split('.').reverse();
  tmp.shift();
  return tmp.join('');
}

// TODO major DRY sins, refactor popup.js to make this easier to maintain
/**
 * Displays list of all tracking domains along with toggle controls.
 */
function refreshFilterPage() {
  refreshOriginCache();

  // Check to see if any tracking domains have been found before continuing.
  var allTrackingDomains = getOriginsArray();
  if (!allTrackingDomains || allTrackingDomains.length == 0) {
    $("#blockedResources").html("Could not detect any tracking cookies.");
    return;
  }

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

  // Update tracking domain count.
  $("#count").text(allTrackingDomains.length);

  // Display tracking domains.
  showTrackingDomains(allTrackingDomains);
  console.log("Done refreshing options page");
}

/**
 * Displays filtered list of tracking domains based on user input.
 * @param event Input event triggered by user.
 */
function filterTrackingDomains(event) {
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

    // Filter tracking domains based on search text.
    var allTrackingDomains = getOriginsArray();
    var filteredTrackingDomains = [];
    for (var i = 0; i < allTrackingDomains.length; i++) {
      var trackingDomain = allTrackingDomains[i];

      // Ignore domains that do not contain search text.
      if (trackingDomain.toLowerCase().indexOf(searchText) !== -1) {
        filteredTrackingDomains.push(trackingDomain);
      }
    }

    showTrackingDomains(filteredTrackingDomains);
  }, timeToWait);
}

/**
 * Displays list of tracking domains along with toggle controls.
 * @param domains Tracking domains to display.
 */
function showTrackingDomains(domains) {
  domains.sort(compareReversedDomains);

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
  $('.switch-toggle').each(function() { registerToggleHandlers(this) });
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
    create: function(event, ui) {
      $(element).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
    },
    slide: function(event, ui) {
      radios.filter('[value=' + ui.value + ']').click();
    },
    stop: function(event, ui) {
      $(ui.handle).css('margin-left', -16 * ui.value + 'px');

      // Save change for origin.
      var origin = radios.filter('[value=' + ui.value + ']')[0].name;
      syncSettings(origin);
    },
  }).appendTo(element);

  radios.change(function() {
    slider.slider('value', radios.filter(':checked').val());
  });
}

function updateOrigin(event){
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  console.log('updating origin for', $elm);
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var action = $elm.data('action');
  $switchContainer.removeClass('block cookieblock noaction').addClass(action);
  toggleBlockedStatus($clicker, action);
  var origin = $clicker.data('origin');
  $clicker.attr('tooltip', htmlUtils.getActionDescription(action, origin));
  $clicker.children('.tooltipContainer').html(htmlUtils.getActionDescription(action, origin));
}

var tooltipDelay = 300;

function displayTooltip(event){
  var $elm = $(event.currentTarget);
  var displayTipTimer = setTimeout(function(){
    if($elm.attr('tooltip').length == 0){ return; }
    var $container = $elm.closest('.clicker').children('.tooltipContainer');
    if($container.length === 0){
      $container = $elm.siblings('.tooltipContainer');
    }
    $container.text($elm.attr('tooltip'));
    $container.show();
    $container.siblings('.tooltipArrow').show();
  },tooltipDelay);
  $elm.on('mouseleave', function(){clearTimeout(displayTipTimer)});
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
  $elm.on('mouseenter',function(){clearTimeout(hideTipTimer)});
}

function getCurrentClass(elt) {
  if ($(elt).hasClass("block"))
    return "block";
  else if ($(elt).hasClass("cookieblock"))
    return "cookieblock";
  else
    return "noaction";
}

/**
 * Fetches origins that need to be synced.
 *
 * @param originToCheck {String} Origin to check for changes, optional. If null,
 *                               all origins are checked.
 * @return {Object}
 */
function getOriginsToSync(originToCheck) {
  // Function to add origin if set by user and changed.
  _fetchOrigins = function() {
    var origin = $(this).attr("data-origin");
    var userset = $(this).hasClass("userset");
    var changed = getCurrentClass(this) != $(this).attr("data-original-action");
    if (userset && changed) {
      origins[origin] = getCurrentClass(this);
    }
  }

  // Check each element for any changes by user.
  var origins = {};
  if (originToCheck) {
    $('.clicker[data-origin="' + originToCheck + '"]').each(_fetchOrigins);
  } else {
    $('.clicker').each(_fetchOrigins);
  }

  return origins;
}

/**
 * Syncs settings for origins changed by user.
 *
 * @param originToCheck {String} Origin to check for changes, optional. If null,
 *                               all origins are checked.
 */
function syncSettings(originToCheck) {
  var originsToSync = getOriginsToSync(originToCheck);
  console.log("Syncing userset options: " + JSON.stringify(originsToSync));

  // Save new action for updated origins.
  for (var origin in originsToSync) {
    var userAction = originsToSync[origin];
    saveAction(userAction, origin);
  }
  console.log("Finished syncing.");

  // Options page needs to be refreshed to display current results.
  refreshFilterPage();
}

document.addEventListener('DOMContentLoaded', function() {
  chrome.tabs.getSelected(null, function(tab) {
    refreshFilterPage();
  });
});
