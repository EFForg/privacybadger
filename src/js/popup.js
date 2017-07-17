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
var backgroundPage = chrome.extension.getBackgroundPage();
var badger = backgroundPage.badger;
var FirefoxAndroid = backgroundPage.FirefoxAndroid;
var htmlUtils = require("htmlutils").htmlUtils;
var constants = require("constants");
var messages = require("messages");

var i18n = chrome.i18n;
var reloadTab = chrome.tabs.reload;

let client = new messages.Client();

/* if they aint seen the comic*/
function showNagMaybe() {
  let nag = $("#instruction"),
    outer = $("#instruction-outer");

  function _hideNag(){
    client.settings.setItem("seenComic", true);
    nag.fadeOut();
    outer.fadeOut();
  }

  client.settings.getItem('seenComic').then((seen) => {
    if (!seen) {
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
}

/**
 * Init function. Showing/hiding popup.html elements and setting up event handler
 */
function init() {
  showNagMaybe();

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
    client.isPrivacyBadgerEnabledForURL(t.url).then(enabled => {
      if (!enabled) {
        $("#blockedResourcesContainer").hide();
        $("#activate_site_btn").show();
        $("#deactivate_site_btn").hide();
      }
    });
  });

  var version = i18n.getMessage("version") + " " +  chrome.runtime.getManifest().version;
  $("#version").text(version);
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
  function getOriginsAndTab(callback) {
    getTab((tab) => {
      client.getAllOriginsForTab(tab).then(origins => {
        callback(origins, tab);
      });
    });
  }
  getOriginsAndTab(function(origins, tab) {
    let browser = window.navigator.userAgent,
      version = chrome.runtime.getManifest().version,
      fqdn = tab.url.split("/",3)[2],
      out = {"browser":browser, "url":tab.url,"fqdn":fqdn, "message":message, "version": version};

    if(!origins){ return; }
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
    client.enablePrivacyBadgerForOriginFromURL(tab.url).then(() => {
      client.refreshIconAndContextMenu(tab);
      reloadTab(tab.id);
    });
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
    client.disablePrivacyBadgerForOriginFromURL(tab.url).then(() => {
      client.refreshIconAndContextMenu(tab);
      reloadTab(tab.id);
    });
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
  var $elm = $(e.target).parent();
  var origin = $elm.data('origin');
  client.storage.revertUserAction(origin);
  client.storage.getBestAction(origin).then(action => {
    var selectorId = "#"+ action +"-" + origin.replace(/\./g,'-');
    var selector = $(selectorId);
    selector.click();
    $elm.removeClass('userset');
    reloadTab(tabId);
  });
  return false;
}

function registerToggleHandlers() {
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
}

/**
* Refresh the content of the popup window
*
* @param {Integer} tabId The id of the tab
*/
function refreshPopup(tabId) {
  let trackerCount = 0,
    printable = [];

  client.getAllOriginsForTab(tabId).then(origins => {
    if (!origins || origins.length === 0) {
      $("#blockedResources").html(i18n.getMessage("popup_blocked"));
      $('#number_trackers').text('0');
      return;
    }

    // Display tracker tooltips.
    $("#blockedResources")[0].innerHTML = htmlUtils.getTrackerContainerHtml(tabId);

    processOrigins(origins, () => {
      $('#number_trackers').text(trackerCount);
      requestAnimationFrame(renderDomains);
    });
  });

  function processOrigins(origins, callback) {
    let tracking = [],
      nonTracking = [];

    origins.sort(htmlUtils.compareReversedDomains);
    process();
    function process() {
      if (origins.length != 0) {
        let origin = origins.shift();
        client.storage.getBestAction(origin).then(action => {
          if (action != constants.DNT) {trackerCount++;}
          if (action == constants.NO_TRACKING) {
            nonTracking.push(htmlUtils.getOriginHtml(origin, constants.NO_TRACKING, false));
          } else {
            tracking.push(htmlUtils.getOriginHtml(origin, action, action == constants.DNT));
          }
          process();
        });
      } else {
        printable.push.apply(printable, tracking);
        if (nonTracking.length > 0) {
          printable.push(
            '<div class="clicker" id="nonTrackers" title="' +
            i18n.getMessage("non_tracker_tip") + '">' +
            i18n.getMessage("non_tracker") + '</div>'
          );
        }
        printable.push.apply(printable, nonTracking);
        callback();
      }
    }
  }

  function renderDomains() {
    const CHUNK = 1;

    let $printable = $(printable.splice(0, CHUNK).join(""));

    $printable.find('.switch-toggle').each(registerToggleHandlers);

    // Hide elements for removing origins (controlled from the options page).
    // Popup shows what's loaded for the current page so it doesn't make sense
    // to have removal ability here.
    $printable.find('.removeOrigin').hide();

    $printable.appendTo('#blockedResourcesInner');

    if (printable.length) {
      requestAnimationFrame(renderDomains);
    }
  }
}

/**
* Event handler for on change (blocked resources container)
*
* @param event
*/
function updateOrigin(event){
  let $elm = $('label[for="' + event.currentTarget.id + '"]');
  let $switchContainer = $elm.parents('.switch-container').first();
  let $clicker = $elm.parents('.clicker').first();
  let action = $elm.data('action');
  $switchContainer.removeClass([
    constants.BLOCK,
    constants.COOKIEBLOCK,
    constants.ALLOW,
    constants.NO_TRACKING].join(" ")).addClass(action);

  htmlUtils.toggleBlockedStatus($($clicker), action);
  let origin = $clicker.data('origin');
  $clicker.attr('tooltip', htmlUtils.getActionDescription(action, origin));
  $clicker.children('.tooltipContainer').html(htmlUtils.getActionDescription(action, origin));
  client.saveAction(action, origin);
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
* reloads the tab and popup if needed
*/
function reloadIfNeeded() {
  $('.clicker').each(function() {
    if ($(this).hasClass("userset") &&
        htmlUtils.getCurrentClass($(this)) != $(this).attr("data-original-action")) {
      let tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
      refreshPopup(tabId);
      reloadTab(tabId);
      return true;
    }
  });
  return false;
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
  // Temporary fix for Firefox Android
  if(FirefoxAndroid.isUsed){
    FirefoxAndroid.getParentOfPopup(callback);
    return;
  }

  chrome.tabs.query({active: true, lastFocusedWindow: true}, t => callback(t[0]));
}

document.addEventListener('DOMContentLoaded', function () {
  getTab(function(t) {
    refreshPopup(t.id);
  });
});

window.addEventListener('unload', function() {
  reloadIfNeeded();
});
