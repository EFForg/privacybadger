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
var imports = ["require", "saveAction", "removeFilter"]
for (var i = 0; i < imports.length; i++){
      window[imports[i]] = backgroundPage[imports[i]];
}
var Utils = require("utils").Utils;
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

// Loads options from localStorage and sets UI elements accordingly
function loadOptions()
{
  
  $('#blockedResources').css('max-height',$(window).height() - 300);
  // Set page title to i18n version of "Privacy Badger Options"
  document.title = i18n.getMessage("options_title");

  // Add event listeners
  window.addEventListener("unload", unloadOptions, false);
  $("#whitelistForm").submit(addWhitelistDomain);
  $("#removeWhitelist").click(removeWhitelistDomain);
  FilterNotifier.addListener(onFilterChange);

  // load resources for filter sliders
  $(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);   
    $('#blockedResourcesContainer').on('mouseenter', '.tooltip', displayTooltip);
    $('#blockedResourcesContainer').on('mouseleave', '.tooltip', hideTooltip);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
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

//TODO: DRY in this and getOriginsList
function getOrigins()
{
  var out = {};
  var green = FilterStorage.knownSubscriptions.userGreen.filters;
  var yellow = FilterStorage.knownSubscriptions.userYellow.filters;
  var red = FilterStorage.knownSubscriptions.userRed.filters;
  var heuristic = FilterStorage.knownSubscriptions.frequencyHeuristic.filters;
  var seen = Object.keys(JSON.parse(localStorage.getItem("seenThirdParties")));
  for( var i = 0; i < green.length; i++){
    out[green[i].regexp.source] = 1;
  }
  for( var i = 0; i < yellow.length; i++){
    out[yellow[i].regexp.source] = 1;
  }
  for( var i = 0; i < red.length; i++){
    out[red[i].regexp.source] = 1;
  }
  for( var i = 0; i < heuristic.length; i++){
    var cur_source = heuristic[i].regexp.source;
    if(!out[cur_source]){ 
        out[cur_source] = 1;
    }
  }
  for( var i = 0; i < seen.length; i++){
    var cur_source = seen[i];
    if(!out[cur_source]){
        out[cur_source] = 1;
    }
  }
  var out_arr = []
  for (elm in out){
      out_arr.push(elm);
  }
  $("#count").text(out_arr.length);
  return out_arr
}

// Cleans up when the options window is closed
function unloadOptions()
{
  FilterNotifier.removeListener(onFilterChange);
}

function onFilterChange(action, item, param1, param2)
{
    syncUISelections();
    refreshFilterPage();
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

function buildOriginList()
{
  out = {}
  var green = FilterStorage.knownSubscriptions.userGreen.filters;
  var yellow = FilterStorage.knownSubscriptions.userYellow.filters;
  var red = FilterStorage.knownSubscriptions.userRed.filters;
  var heuristics = FilterStorage.knownSubscriptions.frequencyHeuristic.filters;
  var seen = Object.keys(JSON.parse(localStorage.getItem("seenThirdParties")));
  var whitelist = FilterStorage.subscriptions[0].filters;
  for (var i = 0; i < green.length; i++){
      out[green[i].regexp.source] = 'usernoaction';
  }
  for (var i = 0; i < yellow.length; i++){
      out[yellow[i].regexp.source] = 'usercookieblock';
  }
  for (var i = 0; i < red.length; i++){
      out[red[i].regexp.source] = 'userblock';
  }
  for (var i = 0; i < heuristics.length; i++){
      var cur_source = heuristics[i].regexp.source;
      if (out[cur_source]){
        continue;
      }
      if (filterWhitelist[cur_source]){
        out[cur_source] = 'cookieblock';
      }
      else{
        out[cur_source] = 'block';
      }
  }
  for (var i = 0; i < seen.length; i++){
      var cur_source = seen[i];
      if (out[cur_source]){
        continue;
      }
      else{
        out[cur_source] = 'noaction';
      }
  }
  return out

}

function optionsGetAction(origin, originList)
{
  var out = originList[origin];
  if (out){ return out;}
  else { return "noaction";}
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
  //TODO: make it not have to build this every time you revert
  var originList = buildOriginList();
  var defaultAction = optionsGetAction(origin, originList);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector =   $(selectorId);
  console.log('selector', selector);
  selector.click();
  $elm.removeClass('userset');
  return false;
}

function toggleEnabled() {
  console.log("Refreshing icon and context menu");
  refreshIconAndContextMenu(tab);
}

// ugly helpers: not to be used!
//TODO: DRY with popup.js
function _addOriginHTML(origin, printable, action) {
  var classes = ["clicker","tooltip"];
  var feedTheBadgerTitle = '';
  if (action.indexOf("user") == 0) {
    feedTheBadgerTitle = i18n.getMessage("feed_the_badger_title");
    classes.push("userset");
    action = action.substr(4);
  }
  if (action == "block" || action == "cookieblock" || action == "noaction")
    classes.push(action);
  var classText = 'class="' + classes.join(" ") + '"';

  return printable + '<div ' + classText + '" data-origin="' + origin + '" tooltip="' + _badgerStatusTitle(action) + '" data-original-action="' + action + '"><div class="origin" >' + _trim(origin,30) + '</div>' + _addToggleHtml(origin, action) + '<div class="honeybadgerPowered tooltip" tooltip="'+ feedTheBadgerTitle + '"></div><img class="tooltipArrow" src="/icons/badger-tb-arrow.png"><div class="tooltipContainer"></div></div>';
}

function _trim(str,max){
  if(str.length >= max){
    return str.slice(0,max-3)+'...';
  } else {
    return str;
  }
}

//TODO: DRY with popup.js
function _badgerStatusTitle(action){
  var prefix = "";
  var status_block = i18n.getMessage("badger_status_block");
  var status_cookieblock = i18n.getMessage("badger_status_cookieblock");
  var status_noaction = i18n.getMessage("badger_status_noaction");

  var statusMap = { 
    block:        status_block,
    cookieblock:  status_cookieblock,
    noaction:     status_noaction 
  }

  return prefix + statusMap[action];
}

function _addToggleHtml(origin, action){
  var idOrigin = origin.replace(/\./g,'-');
  var output = "";
  output += '<div class="switch-container ' + action + '">';
  output += '<div class="switch-toggle switch-3 switch-candy">'
  output += '<input id="block-' + idOrigin + '" name="' + origin + '" value="0" type="radio" '+ _checked('block',action)+ '><label tooltip="click here to block this tracker entirely" class="actionToggle" for="block-' + idOrigin + '" data-origin="' + origin + '" data-action="block"></label>';
  output += '<input id="cookieblock-' + idOrigin + '" name="' + origin + '" value="1" type="radio" '+ _checked('cookieblock',action)+ '><label tooltip="click here to block this tracker from setting cookies" class="actionToggle" for="cookieblock-' + idOrigin + '" data-origin="' + origin + '" data-action="cookieblock"></label>';
  output += '<input id="noaction-' + idOrigin + '" name="' + origin + '" value="2" type="radio" '+ _checked('noaction',action)+ '><label tooltip="click here to allow this tracker" class="actionToggle" for="noaction-' + idOrigin + '" data-origin="' + origin + '" data-action="noaction"></label>';
  output += '<a><img src="/icons/badger-slider-handle.png"></a></div></div>';
  return output;
}
function _checked(name, action){
  if(name == action){
    return 'checked';
  } else {
    return '';
  }
};
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
function refreshFilterPage() {
  var origins = getOrigins();
  if (!origins || origins.length == 0) {
    $("#blockedResources").html("Could not detect any tracking cookies.");
    return;
  }
  // old text that could go in printable: 
  // "Suspicious 3rd party domains in this page.  Red: we've blocked it; 
  // yellow: only cookies blocked; green: no blocking yet";
  var printable = '<div id="associatedTab" data-tab-id="000"></div>';
  printable = printable +
    '<div class="keyContainer">'+
    '<div class="key">'+
    '<img class="tooltip" src="/icons/UI-icons-red.png" tooltip="Move the slider left to block a domain.">'+
    '<img class="tooltip" src="/icons/UI-icons-yellow.png" tooltip="Center the slider to block cookies.">'+
    '<img class="tooltip" src="/icons/UI-icons-green.png" tooltip="Move the slider right to allow a domain.">'+
    '<div class="tooltipContainer"></div>' +
    '</div></div>'+
    '<div class="spacer"></div><div class="clickerContainer">';
  origins.sort(compareReversedDomains);
  var originList = buildOriginList();
  for (var i=0; i < origins.length; i++) {
    var origin = origins[i];
    // todo: gross hack, use templating framework
    var action = optionsGetAction(origin, originList);
    if(!action){ continue; }
    printable = _addOriginHTML(origin, printable, action);
  }
  printable += "</div>"
  $("#blockedResources").empty();
  $("#blockedResources").html(printable);
  $('.switch-toggle').each(function(){
    var radios = $(this).children('input');
    var value = $(this).children('input:checked').val();
    var userHandle = $(this).children('a');
    var slider = $("<div></div>").slider({
      min: 0,
      max: 2,
      value: value,
      create: function(event, ui){
        $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
      },
      slide: function(event, ui) {
        radios.filter("[value=" + ui.value + "]").click();
      },
      stop: function(event, ui){
        $(ui.handle).css('margin-left', -16 * ui.value + "px")
      },
    }).appendTo(this);
    radios.change(function(){
      slider.slider("value",radios.filter(':checked').val());
    });
  });
  console.log("Done refreshing options page");
}


function updateOrigin(event){
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  console.log('updating origin for', $elm);
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var action = $elm.data('action');
  $switchContainer.removeClass('block cookieblock noaction').addClass(action);
  toggleBlockedStatus($clicker, action);
  $clicker.attr('tooltip', _badgerStatusTitle(action));
  $clicker.children('.tooltipContainer').html(_badgerStatusTitle(action));
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

function syncSettingsDict(settingsDict) {
  // track whether reload is needed: only if things are being unblocked
  var reloadNeeded = false;
  // we get the blocked data again in case anything changed, but the user's change when
  // closing a page is authoritative and we should sync the real state to that
  for (var origin in settingsDict) {
    var userAction = settingsDict[origin];
    saveAction(userAction, origin)
  }
  console.log("Finished syncing. Now refreshing options page.");
  // the options page needs to be refreshed to display current results
  refreshFilterPage();
}
function getCurrentClass(elt) {
  if ($(elt).hasClass("block"))
    return "block";
  else if ($(elt).hasClass("cookieblock"))
    return "cookieblock";
  else
    return "noaction";
}

function buildSettingsDict() {
  var settingsDict = {};
  $('.clicker').each(function() {
    var origin = $(this).attr("data-origin");
    if ($(this).hasClass("userset") && getCurrentClass(this) != $(this).attr("data-original-action")) {
      // todo: DRY; same as code above, break out into helper
      if ($(this).hasClass("block"))
        settingsDict[origin] = "block";
      else if ($(this).hasClass("cookieblock"))
        settingsDict[origin] = "cookieblock";
      else
        settingsDict[origin] = "noaction";
    }
  });
  return settingsDict;
}

// syncs the user-selected cookie blocking options, etc
function syncUISelections() {
  var settingsDict = buildSettingsDict();
  console.log("Sync of userset options: " + JSON.stringify(settingsDict));
  syncSettingsDict(settingsDict);
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, function(tab) {
    refreshFilterPage(tab.id);
  });
});
window.addEventListener('unload', function() {
  console.log("Starting to unload options page");
  syncUISelections();
  console.log("unloaded options page");
});


