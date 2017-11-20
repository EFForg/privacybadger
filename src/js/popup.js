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
var badger = backgroundPage.badger;
var FirefoxAndroid = backgroundPage.FirefoxAndroid;
var htmlUtils = require("htmlutils").htmlUtils;

var i18n = chrome.i18n;
var reloadTab = chrome.tabs.reload;

// TODO hack: disable Tooltipster tooltips on Firefox
// to avoid hangs on pages with enough domains to produce a scrollbar
(function () {
let [, browser, ] = navigator.userAgent.match(
  // from https://gist.github.com/ticky/3909462
  /(MSIE|(?!Gecko.+)Firefox|(?!AppleWebKit.+Chrome.+)Safari|(?!AppleWebKit.+)Chrome|AppleWebKit(?!.+Chrome|.+Safari)|Gecko(?!.+Firefox))(?: |\/)([\d.apre]+)/
);
if (browser == "Firefox") {
  $.fn.tooltipster = function () {};
}
}());

/* if they aint seen the comic*/
function showNagMaybe() {
  var nag = $("#instruction");
  var outer = $("#instruction-outer");
  var settings = badger.storage.getBadgerStorageObject('settings_map');
  var seenComic = settings.getItem("seenComic") || false;

  function _setSeenComic() {
    settings.setItem("seenComic", true);
  }

  function _hideNag() {
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
}

/**
 * Init function. Showing/hiding popup.html elements and setting up event handler
 */
function init(tab) {
  showNagMaybe();

  $("#activate_site_btn").click(active_site);
  $("#deactivate_site_btn").click(deactive_site);
  $("#donate").click(function() {
    chrome.tabs.create({
      url: "https://supporters.eff.org/donate/support-privacy-badger"
    });
  });

  var overlay = $('#overlay');
  $("#error").click(function() {
    overlay.toggleClass('active');
  });
  $("#report_cancel").click(function() {
    closeOverlay();
  });
  $("#report_button").click(function() {
    $(this).prop("disabled", true);
    $("#report_cancel").prop("disabled", true);
    send_error($("#error_input").val());
  });
  $("#report_close").click(function() {
    closeOverlay();
  });
  $(document).ready(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
  });

  // toggle activation buttons if privacy badger is not enabled for current url
  if (!badger.isPrivacyBadgerEnabled(backgroundPage.extractHostFromURL(tab.url))) {
    $("#blockedResourcesContainer").hide();
    $("#activate_site_btn").show();
    $("#deactivate_site_btn").hide();
  }

  var version = i18n.getMessage("version") + " " + chrome.runtime.getManifest().version;
  $("#version").text(version);
}

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
  var browser = window.navigator.userAgent;
  getTab(function(tab) {
    var tabId = tab.id;
    var origins = badger.getAllOriginsForTab(tabId);
    if (!origins) { return; }
    var version = chrome.runtime.getManifest().version;
    var fqdn = backgroundPage.extractHostFromURL(tab.url);
    var out = {"browser":browser, "url":tab.url,"fqdn":fqdn, "message":message, "version": version};
    for (var i = 0; i < origins.length; i++) {
      var origin = origins[i];
      var action = badger.storage.getBestAction(origin);
      if (!action) { action = constants.NO_TRACKING; }
      if (out[action]) {
        out[action] += ","+origin;
      } else {
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
      setTimeout(function() {
        $("#report_button").prop("disabled", false);
        $("#report_cancel").prop("disabled", false);
        $("#report_success").toggleClass("hidden", true);
        closeOverlay();
      }, 3000);
    });
    sendReport.fail(function() {
      $("#report_fail").toggleClass("hidden");
      setTimeout(function() {
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
function active_site() {
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").show();
  getTab(function(tab) {
    badger.enablePrivacyBadgerForOrigin(backgroundPage.extractHostFromURL(tab.url));
    badger.refreshIconAndContextMenu(tab);
    reloadTab(tab.id);
    window.close();
  });
}

/**
* de-activate PB for site event handler
*/
function deactive_site() {
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").hide();
  getTab(function(tab) {
    badger.disablePrivacyBadgerForOrigin(backgroundPage.extractHostFromURL(tab.url));
    badger.refreshIconAndContextMenu(tab);
    reloadTab(tab.id);
    window.close();
  });
}

/**
* Handler to undo user selection for a tracker
*
* @param e The object the event triggered on
* @returns {boolean} false
*/
function revertDomainControl(e) {
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var $elm = $(e.target).parent();
  var origin = $elm.data('origin');
  badger.storage.revertUserAction(origin);
  var defaultAction = badger.storage.getBestAction(origin);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector = $(selectorId);
  selector.click();
  $elm.removeClass('userset');
  reloadTab(tabId);
  window.close();
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
    create: function(/*event, ui*/) {
      $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
    },
    slide: function(event, ui) {
      radios.filter("[value=" + ui.value + "]").click();
    },
    stop: function(event, ui) {
      $(ui.handle).css('margin-left', -16 * ui.value + "px");
    },
  }).appendTo(this);

  radios.change(function() {
    slider.slider("value",radios.filter(':checked').val());
  });
}

/**
* Refresh the content of the popup window
*
* @param {Integer} tabId The id of the tab
*/
function refreshPopup(tabId) {
  // must be a special browser page,
  // or a page that loaded everything before our most recent initialization
  if (!badger.tabData.hasOwnProperty(tabId)) {
    // replace inapplicable summary text with a Badger logo
    $('#blockedResourcesContainer').hide();
    $('#big-badger-logo').show();

    // hide inapplicable buttons
    $('#deactivate_site_btn').hide();
    $('#error').hide();

    // activate tooltips
    $('.tooltip').tooltipster();

    return;

  } else {
    // revert any hiding/showing above for cases when refreshPopup gets called
    // more than once for the same popup, such as during functional testing
    $('#blockedResourcesContainer').show();
    $('#big-badger-logo').hide();
    $('#deactivate_site_btn').show();
    $('#error').show();
  }

  let origins = badger.getAllOriginsForTab(tabId);

  if (!origins || origins.length === 0) {
    $("#blockedResources").html(i18n.getMessage("popup_blocked"));
    $('#number_trackers').text('0');

    // activate tooltips
    $('.tooltip').tooltipster();

    return;
  }

  // Get containing HTML for domain list along with toggle legend icons.
  $("#blockedResources")[0].innerHTML = htmlUtils.getTrackerContainerHtml(tabId);

  // activate tooltips
  $('.tooltip').tooltipster();

  var printable = [];
  var nonTracking = [];
  origins.sort(htmlUtils.compareReversedDomains);
  var trackerCount = 0;

  for (let i=0; i < origins.length; i++) {
    var origin = origins[i];
    // todo: gross hack, use templating framework
    var action = badger.storage.getBestAction(origin);

    if (action == constants.NO_TRACKING) {
      nonTracking.push(origin);
      continue;
    }

    if (action != constants.DNT) {
      trackerCount++;
    }
    printable.push(
      htmlUtils.getOriginHtml(origin, action, action == constants.DNT)
    );
  }

  var nonTrackerText = i18n.getMessage("non_tracker");
  var nonTrackerTooltip = i18n.getMessage("non_tracker_tip");

  if (nonTracking.length > 0) {
    printable.push(
      '<div class="clicker tooltip" id="nonTrackers" title="'+nonTrackerTooltip+'" data-tooltipster=\'{"side":"top"}\'>'+nonTrackerText+'</div>'
    );
    for (let i = 0; i < nonTracking.length; i++) {
      printable.push(
        htmlUtils.getOriginHtml(nonTracking[i], constants.NO_TRACKING, false)
      );
    }
  }

  $('#number_trackers').text(trackerCount);

  function renderDomains() {
    const CHUNK = 1;

    let $printable = $(printable.splice(0, CHUNK).join(""));

    $printable.find('.switch-toggle').each(registerToggleHandlers);

    // Hide elements for removing origins (controlled from the options page).
    // Popup shows what's loaded for the current page so it doesn't make sense
    // to have removal ability here.
    $printable.find('.removeOrigin').hide();

    $printable.appendTo('#blockedResourcesInner');

    // activate tooltips
    $('#blockedResourcesInner .tooltip:not(.tooltipstered)').tooltipster(
      htmlUtils.DOMAIN_TOOLTIP_CONF);

    if (printable.length) {
      requestAnimationFrame(renderDomains);
    }
  }
  requestAnimationFrame(renderDomains);
}

/**
* Event handler for on change (blocked resources container)
*
* @param event
*/
function updateOrigin(event) {
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
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
* Check if origin is in setting dict. If yes, popup needs refresh
*
* @param settingsDict The settings dict to check
* @returns {boolean} false or the tab id
*/
function syncSettingsDict(settingsDict) {
  // track whether reload is needed: only if things are being unblocked
  var reloadNeeded = false;
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  // we get the blocked data again in case anything changed, but the user's change when
  // closing a popup is authoritative and we should sync the real state to that
  for (var origin in settingsDict) {
    var userAction = settingsDict[origin];
    if (badger.saveAction(userAction, origin)) {
      reloadNeeded = tabId; // js question: slower than "if (!reloadNeeded) reloadNeeded = true"? would be fun to check with jsperf.com
    }
  }

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
  var tabId = syncSettingsDict(settingsDict);
  if (tabId) {
    backgroundPage.reloadTab(tabId);
  }
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
  if (!FirefoxAndroid.hasPopupSupport) {
    FirefoxAndroid.getParentOfPopup(callback);
    return;
  }

  chrome.tabs.query({active: true, lastFocusedWindow: true}, function(t) { callback(t[0]); });
}

document.addEventListener('DOMContentLoaded', function () {
  getTab(function (tab) {
    refreshPopup(tab.id);
    init(tab);
  });
});

window.addEventListener('unload', function() {
  syncUISelections();
});
