/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
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
 // TODO: This code is a hideous mess and desperately needs to be refactored and cleaned up.

var backgroundPage = chrome.extension.getBackgroundPage();
var require = backgroundPage.require;
var constants = backgroundPage.constants;


var htmlUtils = require("htmlutils").htmlUtils;
var i18n = chrome.i18n;
var reloadTab = chrome.tabs.reload;

/**
 * Init function. Showing/hiding popup.html elements and setting up event handler
 */
function init() {
  var nag = $("#instruction");
  var outer = $("#instruction-outer");

  /* if they aint seen the comic*/
  getTab(function(tab) {
    var badger = backgroundPage.getBadgerWithTab(tab.id);
    var settings = badger.storage.getBadgerStorageObject('settings_map');
    var seenComic = settings.getItem("seenComic") || false;

    function _setSeenComic() {
      settings.setItem("seenComic", "true");
    }

    function _hideNag(){
      _setSeenComic();
      nag.fadeOut();
      outer.fadeOut();
    }

    if (!seenComic) {
      nag.show();
      outer.show();
      // Attach event listeners
      $('#fittslaw').click(_hideNag);
      $("#firstRun").click(function() {
        chrome.tabs.create({
          url: chrome.extension.getURL("/skin/firstRun.html#slideshow")
        });
        _hideNag();
      });
    }
  });

  $("#activate_site_btn").click(active_site);
  $("#deactivate_site_btn").click(deactive_site);
  $("#donate").click(function() {
    chrome.tabs.create({
      url: "https://supporters.eff.org/donate/support-privacy-badger"
    });
  });
  $("#error_input").attr("placeholder", i18n.getMessage("error_input"));

  var overlay = $('#overlay');
  $("#error").click(function(){
    overlay.toggleClass('active');
  });
  $("#report_cancel").click(function(){
    closeOverlay();
  });
  $("#report_button").click(function(){
    $(this).prop("disabled", true);
    $("#report_cancel").prop("disabled", true);
    send_error($("#error_input").val());
  });
  $("#report_close").click(function(){
    closeOverlay();
  });
  $(document).ready(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
    $('#blockedResourcesContainer').on('mouseenter', '.tooltip', displayTooltip);
    $('#blockedResourcesContainer').on('mouseleave', '.tooltip', hideTooltip);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
  });

  //toggle activation buttons if privacy badger is not enabled for current url
  getTab(function(t) {
    var badger = backgroundPage.getBadgerWithTab(t.id);
    if(!badger.isPrivacyBadgerEnabled(backgroundPage.extractHostFromURL(t.url))) {
      $("#blockedResourcesContainer").hide();
      $("#activate_site_btn").show();
      $("#deactivate_site_btn").hide();
    }
  });
}
$(init);

/**
* Close the error reporting overlay
*/
function closeOverlay() {
  $('#overlay').toggleClass('active', false);
  $("#report_success").toggleClass("hidden", true);
  $("#report_fail").toggleClass("hidden", true);
  $("#error_input").val("");
}

/**
* Send errors to PB error reporting server
*
* @param {String} message The message to send
*/
function send_error(message) {
  var browser = window.navigator.useragent;
  getTab(function(tab) {
    var tabId = tab.id;
    var badger = backgroundPage.getBadgerWithTab(tabId);
    var origins = badger.getAllOriginsForTab(tabId);
    if(!origins){ return; }
    var version = chrome.runtime.getManifest().version;
    //TODO "there's got to be a better way!"
    var fqdn = tab.url.split("/",3)[2];
    var out = {"browser":browser, "url":tab.url,"fqdn":fqdn, "message":message, "version": version};
    for (var i = 0; i < origins.length; i++){
      var origin = origins[i];
      var action = badger.storage.getBestAction(origin);
      if (!action){ action = constants.NO_TRACKING; }
      if (out[action]){
        out[action] += ","+origin;
      }
      else{
        out[action] = origin;
      }
    }
    var out_data = JSON.stringify(out);
    backgroundPage.log(out_data);
    var sendReport = $.ajax({
      type: "POST",
      url: "https://privacybadger.org/reporting",
      data: out_data,
      contentType: "application/json"
    });
    sendReport.done(function() {
      $("#error_input").val("");
      $("#report_success").toggleClass("hidden", false);
      setTimeout(function(){
        $("#report_button").prop("disabled", false);
        $("#report_cancel").prop("disabled", false);
        $("#report_success").toggleClass("hidden", true);
        closeOverlay();
      }, 3000);
    });
    sendReport.fail(function() {
      $("#report_fail").toggleClass("hidden");
      setTimeout(function(){
        $("#report_button").prop("disabled", false);
        $("#report_cancel").prop("disabled", false);
        $("#report_fail").toggleClass("hidden", true);
      }, 3000);
    });
  });
}

/**
* activate PB for site event handler
*/
function active_site(){
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").show();
  getTab(function(tab) {
    var badger = backgroundPage.getBadgerWithTab(tab.id);
    badger.enablePrivacyBadgerForOrigin(backgroundPage.extractHostFromURL(tab.url));
    badger.refreshIconAndContextMenu(tab);
    reloadTab(tab.id);
  });
}

/**
* de-activate PB for site event handler
*/
function deactive_site(){
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").hide();
  getTab(function(tab) {
    var badger = backgroundPage.getBadgerWithTab(tab.id);
    badger.disablePrivacyBadgerForOrigin(backgroundPage.extractHostFromURL(tab.url));
    badger.refreshIconAndContextMenu(tab);
    reloadTab(tab.id);
  });
}

/**
* Handler to undo user selection for a tracker
*
* @param e The object the event triggered on
* @returns {boolean} false
*/
function revertDomainControl(e){
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var badger = backgroundPage.getBadgerWithTab(tabId);
  var $elm = $(e.target).parent();
  backgroundPage.log('revert to privacy badger control for', $elm);
  var origin = $elm.data('origin');
  badger.storage.revertUserAction(origin);
  var defaultAction = badger.storage.getBestAction(origin);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector =   $(selectorId);
  backgroundPage.log('selector', selector);
  selector.click();
  $elm.removeClass('userset');
  reloadTab(tabId);
  return false;
}

/**
* this is a terrible function that repeats
* a lot of the work that getAction does
* because getAction stores things in mysery
* land and there's no real way to get what's
* in the ABP filters without repeatedly
* querying them
*/
//TODO re-write this by having get best action return the domain the rule
// comes from, and combine that way?
function getTopLevel(action, origin/*, tabId*/){
  //  if (action == "usercookieblock"){
  //    var top = backgroundPage.getDomainFromFilter(matcherStore.combinedMatcherStore.userYellow.matchesAny(origin, "SUBDOCUMENT", getHostForTab(tabId), true).text);
  //    return  top;
  //  }
  //  if (action == "userblock"){
  //    var top = backgroundPage.getDomainFromFilter(matcherStore.combinedMatcherStore.userRed.matchesAny(origin, "SUBDOCUMENT", getHostForTab(tabId), true).text);
  //    return top;
  //  }
  //  if (action == "usernoaction"){
  //    var top = backgroundPage.getDomainFromFilter(matcherStore.combinedMatcherStore.userGreen.matchesAny(origin, "SUBDOCUMENT", getHostForTab(tabId), true).text);
  //    return top;
  //  }
  return origin;
}

/**
* Refresh the content of the popup window
*
* @param {Integer} tabId The id of the tab
*/
function refreshPopup(tabId) {
  backgroundPage.log("Refreshing popup for tab id " + tabId);
  //TODO this is calling get action and then being used to call get Action
  var badger = backgroundPage.getBadgerWithTab(tabId);
  var origins = badger.getAllOriginsForTab(tabId);
  if (!origins || origins.length === 0) {
    hideNoInitialBlockingLink();
    $("#blockedResources").html(i18n.getMessage("popup_blocked"));
    $('#number_trackers').text('0');
    return;
  }
  var printable = '<div id="associatedTab" data-tab-id="' + tabId + '"></div>';
  printable = printable +
  '<div class="keyContainer">'+
  '<div class="key">'+
  '<img class="tooltip" src="/icons/UI-icons-red.png" tooltip="Move the slider left to block a domain.">'+
  '<img class="tooltip" src="/icons/UI-icons-yellow.png" tooltip="Center the slider to block cookies.">'+
  '<img class="tooltip" src="/icons/UI-icons-green.png" tooltip="Move the slider right to allow a domain.">'+
  '<div class="tooltipContainer"></div>' +
  '</div></div>'+
  '<div class="spacer"></div><div class="clickerContainer">';
  var nonTracking = [];
  origins.sort(htmlUtils.compareReversedDomains);
  var originCount = 0;
  var compressedOrigins = {};
  for (var i=0; i < origins.length; i++) {
    var origin = origins[i];
    // todo: gross hack, use templating framework
    var action = badger.storage.getBestAction(origin);
    if(action == constants.NO_TRACKING){
      backgroundPage.log('pushing', origin, 'onto non tracking');
      nonTracking.push(origin);
      continue;
    }
    else {
      if (action.includes("user")){
        var prevOrigin = origin;
        var baseDomain = backgroundPage.getBaseDomain(prevOrigin);
        // TODO make some re-implementation of getBestAction that returns where the
        // user rule is coming from
        if (getTopLevel(action, origin, tabId) == baseDomain && baseDomain != origin){
          origin = baseDomain;
          if (compressedOrigins.hasOwnProperty(origin)){
            compressedOrigins[origin].subs.push(prevOrigin.replace(origin, ''));
            continue;
          }
          compressedOrigins[origin] = {'action': action, 'subs':[prevOrigin.replace(origin, '')]};
          continue;
        }
      }
    }
    originCount++;
    var flag = (action == constants.DNT);
    printable = htmlUtils.addOriginHtml(printable, origin, action, flag);
  }
  for (var key in compressedOrigins){
    var flag2 = (compressedOrigins[key].action == constants.DNT);
    printable = htmlUtils.addOriginHtml(printable, key, compressedOrigins[key].action, flag2, compressedOrigins[key].subs.length);
  }
  var nonTrackerText = i18n.getMessage("non_tracker");
  var nonTrackerTooltip = i18n.getMessage("non_tracker_tip");
  backgroundPage.log('len', nonTracking.length);
  if(nonTracking.length > 0){
    printable = printable + '<div class="clicker" id="nonTrackers" title="'+nonTrackerTooltip+'">'+nonTrackerText+'</div>';
    for (var c = 0; c < nonTracking.length; c++){
      var ntOrigin = nonTracking[c];
      backgroundPage.log('calling printable for non-tracking');
      printable = htmlUtils.addOriginHtml(printable, ntOrigin, constants.NO_TRACKING, false);
    }
  }
  $('#number_trackers').text(originCount);
  printable += "</div>";
  $("#blockedResources").empty();
  $("#blockedResources").html(printable);
  $('.switch-toggle').each(function(){
    var radios = $(this).children('input');
    var value = $(this).children('input:checked').val();
    //var userHandle = $(this).children('a');
    var slider = $("<div></div>").slider({
      min: 0,
      max: 2,
      value: value,
      create: function(/*event, ui*/){
        $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
      },
      slide: function(event, ui) {
        radios.filter("[value=" + ui.value + "]").click();
      },
      stop: function(event, ui){
        $(ui.handle).css('margin-left', -16 * ui.value + "px");
      },
    }).appendTo(this);
    radios.change(function(){
      slider.slider("value",radios.filter(':checked').val());
    });
  });
  adjustNoInitialBlockingLink();

  // Hide elements for removing origins (controlled from the options page).
  // Popup shows what's loaded for the current page so it doesn't make sense
  // to have removal ability here.
  $('.removeOrigin').hide();

  backgroundPage.log("Done refreshing popup");
}

/**
* Event handler for on change (blocked resources container)
*
* @param event
*/
function updateOrigin(event){
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  backgroundPage.log('updating origin for', $elm);
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var action = $elm.data('action');
  $switchContainer.removeClass([
    constants.BLOCK,
    constants.COOKIEBLOCK,
    constants.ALLOW,
    constants.NO_TRACKING].join(" ")).addClass(action);
  htmlUtils.toggleBlockedStatus($($clicker), action);
  var origin = $clicker.data('origin');
  $clicker.attr('tooltip', htmlUtils.getActionDescription(action, origin));
  $clicker.children('.tooltipContainer').html(htmlUtils.getActionDescription(action, origin));
  hideNoInitialBlockingLink();
}

/**
* Hide #noBlockingLink
*/
function hideNoInitialBlockingLink() {
  $("#noBlockingLink").hide();
}

/**
* Hide or show additional info depending on if there is any additional info
*/
function adjustNoInitialBlockingLink() {
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var badger = backgroundPage.getBadgerWithTab(tabId);
  var origins = badger.blockedOriginCount(tabId);
  var totalBlocked = badger.activelyBlockedOriginCount(tabId);
  var userBlocked = badger.userConfiguredOriginCount(tabId);
  if (origins > 0 && totalBlocked === 0 && userBlocked === 0) {
    $("#noBlockingLink").show();
  } else {
    $("#noBlockingLink").hide();
  }
}

var tooltipDelay = 300;

/**
* Show tooltip for elements
*
* @param event
*/
function displayTooltip(event){
  var $elm = $(event.currentTarget);
  var displayTipTimer = setTimeout(function(){
    if($elm.attr('tooltip').length === 0){ return; }
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

/**
* Hide tooltip for element
*
* @param event
*/
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
* Check if origin is in setting dict. If yes, popup needs refresh
*
* @param settingsDict The settings dict to check
* @returns {boolean} false or the tab id
*/
function syncSettingsDict(settingsDict) {
  // track whether reload is needed: only if things are being unblocked
  var reloadNeeded = false;
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var badger = backgroundPage.getBadgerWithTab(tabId);
  // we get the blocked data again in case anything changed, but the user's change when
  // closing a popup is authoritative and we should sync the real state to that
  for (var origin in settingsDict) {
    var userAction = settingsDict[origin];
    if (badger.saveAction(userAction, origin)) {
      reloadNeeded = tabId; // js question: slower than "if (!reloadNeeded) reloadNeeded = true"? would be fun to check with jsperf.com
    }
  }
  backgroundPage.log("Finished syncing. Now refreshing popup.");
  // the popup needs to be refreshed to display current results
  refreshPopup(tabId);
  return reloadNeeded;
}

/**
* Generates dict Origin->action based on GUI elements
*
* @returns {{}} The generated dict
*/
function buildSettingsDict() {
  var settingsDict = {};
  $('.clicker').each(function() {
    var origin = $(this).attr("data-origin");
    if ($(this).hasClass("userset") && htmlUtils.getCurrentClass($(this)) != $(this).attr("data-original-action")) {
      // TODO: DRY; same as code above, break out into helper
      if ($(this).hasClass(constants.BLOCK)) {
        settingsDict[origin] = constants.BLOCK;
      } else if ($(this).hasClass(constants.COOKIEBLOCK)) {
        settingsDict[origin] = constants.COOKIEBLOCK;
      } else if ($(this).hasClass(constants.ALLOW)) {
        settingsDict[origin] = constants.ALLOW;
      } else {
        settingsDict[origin] = constants.ALLOW;
      }
    }
  });
  return settingsDict;
}

/**
* syncs the user-selected cookie blocking options, etc.
* Reloads the tab if needed
*/
function syncUISelections() {
  var settingsDict = buildSettingsDict();
  backgroundPage.log("Sync of userset options: " + JSON.stringify(settingsDict));
  var tabId = syncSettingsDict(settingsDict);
  if (tabId){
    backgroundPage.reloadTab(tabId);
  }
}

/**
* if the query url pattern matches a tab, switch the module's tab object to that tab
* Convenience function for the test harness
* Chrome url patterns are docs here: https://developer.chrome.com/extensions/match_patterns
*/
function setTabToUrl( query_url ) { // eslint-disable-line no-unused-vars
  chrome.tabs.query( {url: query_url}, function(ta) {
    if ( typeof ta == "undefined" ) {
      backgroundPage.log("error doing tabs query for " + query_url);
      return;
    }
    if ( ta.length === 0 ) {
      backgroundPage.log("no match found in tabs query for " + query_url);
      return;
    }
    var tabid = ta[0].id;
    backgroundPage.log("match found for query " + query_url + " tabId: " + tabid );
    refreshPopup( tabid );
  });
}

/**
* We use this function where:
* * getting the tabId from the associatedTab id won't work because
*   associatedTab isn't set yet.
* * we need more info than just tab.id, like tab.url.
*
* Maybe we don't even need to use the associatedTab id. It's only advantage
* seems to be that it is synchronous.
*/
function getTab(callback) {
  chrome.tabs.query({active: true, lastFocusedWindow: true}, function(t) { callback(t[0]); });
}

document.addEventListener('DOMContentLoaded', function () {
  getTab(function(t) {
    backgroundPage.log("from addEventListener");
    refreshPopup(t.id);
  });
});

window.addEventListener('unload', function() {
  backgroundPage.log("Starting to unload popup");
  syncUISelections();
  backgroundPage.log("unloaded popup");
});
