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

window.POPUP_INITIALIZED = false;
window.SLIDERS_DONE = false;

var constants = require("constants");
var FirefoxAndroid = require("firefoxandroid");
var htmlUtils = require("htmlutils").htmlUtils;

let POPUP_DATA = {};

// TODO hack: disable Tooltipster tooltips on Firefox
// to avoid hangs on pages with enough domains to produce a scrollbar
(function () {
const matches = navigator.userAgent.match(
  // from https://gist.github.com/ticky/3909462
  /(MSIE|(?!Gecko.+)Firefox|(?!AppleWebKit.+Chrome.+)Safari|(?!AppleWebKit.+)Chrome|AppleWebKit(?!.+Chrome|.+Safari)|Gecko(?!.+Firefox))(?: |\/)([\d.apre]+)/
);
if (!matches || matches[1] == "Firefox") {
  $.fn.tooltipster = function () {};
}
}());

/* if they aint seen the comic*/
function showNagMaybe() {
  var nag = $("#instruction");
  var outer = $("#instruction-outer");
  var firstRunUrl = chrome.runtime.getURL("/skin/firstRun.html");

  function _setSeenComic() {
    chrome.runtime.sendMessage({
      type: "seenComic"
    });
  }

  function _hideNag() {
    _setSeenComic();
    nag.fadeOut();
    outer.fadeOut();
  }

  function _showNag() {
    nag.show();
    outer.show();
    // Attach event listeners
    $('#fittslaw').on("click", _hideNag);
    $("#firstRun").on("click", function() {
      // If there is a firstRun.html tab, switch to the tab.
      // Otherwise, create a new tab
      chrome.tabs.query({url: firstRunUrl}, function (tabs) {
        if (tabs.length == 0) {
          chrome.tabs.create({
            url: chrome.runtime.getURL("/skin/firstRun.html#slideshow")
          });
        } else {
          chrome.tabs.update(tabs[0].id, {active: true}, function (tab) {
            chrome.windows.update(tab.windowId, {focused: true});
          });
        }
        _hideNag();
      });
    });
  }

  if (!POPUP_DATA.seenComic) {
    chrome.tabs.query({active: true, currentWindow: true}, function (focusedTab) {
      // Show the popup instruction if the active tab is not firstRun.html page
      if (!focusedTab[0].url.startsWith(firstRunUrl)) {
        _showNag();
      }
    });
  } else if (POPUP_DATA.criticalError) {
    $('#instruction-text').hide();
    $('#error-text').show().find('a').attr('id', 'firstRun').css('padding', '5px');
    $('#error-message').text(POPUP_DATA.criticalError);
    _showNag();
  }
}

/**
 * Init function. Showing/hiding popup.html elements and setting up event handler
 */
function init() {
  showNagMaybe();

  $("#activate_site_btn").on("click", activateOnSite);
  $("#deactivate_site_btn").on("click", deactivateOnSite);
  $("#donate").on("click", function() {
    chrome.tabs.create({
      url: "https://supporters.eff.org/donate/support-privacy-badger"
    });
  });

  $('#error_input').on('input propertychange', function() {
    // No easy way of sending message on popup close, send message for every change
    chrome.runtime.sendMessage({
      type: 'saveErrorText',
      tabId: POPUP_DATA.tabId,
      errorText: $("#error_input").val()
    });
  });

  let overlay = $('#overlay');

  // show error layout if the user was writing an error report
  if (POPUP_DATA.hasOwnProperty('errorText') && POPUP_DATA.errorText) {
    overlay.toggleClass('active');
  }

  $("#error").on("click", function() {
    overlay.toggleClass('active');
  });
  $("#report_cancel").on("click", function() {
    clearSavedErrorText();
    closeOverlay();
  });
  $("#report_button").on("click", function() {
    $(this).prop("disabled", true);
    $("#report_cancel").prop("disabled", true);
    send_error($("#error_input").val());
  });
  $("#report_close").on("click", function() {
    clearSavedErrorText();
    closeOverlay();
  });
  $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
  $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);

  $("#version").text(
    chrome.i18n.getMessage("version", chrome.runtime.getManifest().version)
  );

  // improve on Firefox's built-in options opening logic
  if (typeof browser == "object" && typeof browser.runtime.getBrowserInfo == "function") {
    browser.runtime.getBrowserInfo().then(function (info) {
      if (info.name == "Firefox") {
        $("#options").on("click", function (e) {
          openOptionsPage();
          e.preventDefault();
        });
      }
    });
  }

  let shareOverlay = $("#share_overlay");

  $("#share").on("click", share);
  $("#share_close").on("click", function() {
    shareOverlay.toggleClass('active', false);
  });
  $("#copy_button").on("click", function() {
    $("#share_output").select();
    document.execCommand('copy');
    $(this).text(chrome.i18n.getMessage("copy_button_copied"));
  });

  window.POPUP_INITIALIZED = true;
}

function openOptionsPage() {
  const url = chrome.runtime.getURL("/skin/options.html");

  // first get the active tab
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    let activeTab = tabs[0],
      tabProps = {
        url,
        windowId: activeTab.windowId,
        active: true,
        index: activeTab.index + 1,
        openerTabId: activeTab.id
      };

    // create the new tab
    try {
      chrome.tabs.create(tabProps);
    } catch (e) {
      // TODO workaround for pre-57 Firefox
      delete tabProps.openerTabId;
      chrome.tabs.create(tabProps);
    }
  });
}

function clearSavedErrorText() {
  chrome.runtime.sendMessage({
    type: 'removeErrorText',
    tabId: POPUP_DATA.tabId
  });
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
  // get the latest domain list from the background page
  chrome.runtime.sendMessage({
    type: "getPopupData",
    tabId: POPUP_DATA.tabId,
    tabUrl: POPUP_DATA.tabUrl
  }, (response) => {
    const origins = response.origins;

    if (!origins) {
      return;
    }

    let out = {
      browser: window.navigator.userAgent,
      fqdn: response.tabHost,
      message: message,
      url: response.tabUrl,
      version: chrome.runtime.getManifest().version
    };

    for (let origin in origins) {
      let action = origins[origin];

      if (!action) {
        action = constants.NO_TRACKING;
      }

      // adjust action names for error reporting
      if (action == constants.USER_ALLOW) {
        action = "usernoaction";
      } else if (action == constants.USER_BLOCK) {
        action = "userblock";
      } else if (action == constants.USER_COOKIE_BLOCK) {
        action = "usercookieblock";
      }

      if (out[action]) {
        out[action] += ","+origin;
      } else {
        out[action] = origin;
      }
    }

    var sendReport = $.ajax({
      type: "POST",
      url: "https://privacybadger.org/reporting",
      data: JSON.stringify(out),
      contentType: "application/json"
    });

    sendReport.done(function() {
      $("#error_input").val("");
      $("#report_success").toggleClass("hidden", false);

      clearSavedErrorText();

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
function activateOnSite() {
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").show();

  chrome.runtime.sendMessage({
    type: "activateOnSite",
    tabHost: POPUP_DATA.tabHost,
    tabId: POPUP_DATA.tabId,
    tabUrl: POPUP_DATA.tabUrl
  }, () => {
    chrome.tabs.reload(POPUP_DATA.tabId);
    window.close();
  });
}

/**
 * de-activate PB for site event handler
 */
function deactivateOnSite() {
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").hide();

  chrome.runtime.sendMessage({
    type: "deactivateOnSite",
    tabHost: POPUP_DATA.tabHost,
    tabId: POPUP_DATA.tabId,
    tabUrl: POPUP_DATA.tabUrl
  }, () => {
    chrome.tabs.reload(POPUP_DATA.tabId);
    window.close();
  });
}

/**
 * Open the share overlay
 */
function share() {
  $("#share_overlay").toggleClass('active');
  let shareMessage = chrome.i18n.getMessage("share_base_message");

  //Only add language about found trackers if we actually found trackers (but regardless of whether we are actually blocking them).
  if (POPUP_DATA.noTabData) {
    $("#share_output").val(shareMessage);
    return;
  }

  let origins = POPUP_DATA.origins;
  let originsArr = [];
  if (origins) {
    originsArr = Object.keys(origins);
  }

  if (!originsArr.length) {
    $("#share_output").val(shareMessage);
    return;
  }

  originsArr = htmlUtils.sortDomains(originsArr);
  let tracking = [];

  for (let i=0; i < originsArr.length; i++) {
    let origin = originsArr[i];
    let action = origins[origin];

    if (action != constants.NO_TRACKING) {
      tracking.push(origin);
    }
  }

  if (tracking.length) {
    shareMessage += "\n\n" + chrome.i18n.getMessage("share_tracker_header", [tracking.length, POPUP_DATA.tabHost]) + "\n\n";

    for (let i=0; i < tracking.length; i++) {
      shareMessage += tracking[i] + "\n";
    }
  }
  $("#share_output").val(shareMessage);
}

/**
 * Handler to undo user selection for a tracker
 *
 * @param {Event} e The object the event triggered on
 */
function revertDomainControl(e) {
  var $elm = $(e.target).parent();
  var origin = $elm.data('origin');
  chrome.runtime.sendMessage({
    type: "revertDomainControl",
    origin: origin
  }, () => {
    chrome.tabs.reload(POPUP_DATA.tabId);
    window.close();
  });
}

function registerToggleHandlers() {
  // (this == .switch-toggle)
  var radios = $(this).children('input');
  var value = $(this).children('input:checked').val();
  //var userHandle = $(this).children('a');

  var slider = $("<div></div>").slider({
    min: 0,
    max: 2,
    value: value,
    create: function(/*event, ui*/) {
      // Set the margin for the handle of the slider we're currently creating,
      // depending on its blocked/cookieblocked/allowed value (this == .ui-slider)
      $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
    },
    slide: function(event, ui) {
      radios.filter("[value=" + ui.value + "]").click();
    },
    stop: function(event, ui) {
      $(ui.handle).css('margin-left', -16 * ui.value + "px");
    },
  }).appendTo(this);

  radios.on("change", function () {
    slider.slider("value", radios.filter(':checked').val());
  });
}

/**
 * Refresh the content of the popup window
 *
 * @param {Integer} tabId The id of the tab
 */
function refreshPopup() {
  window.SLIDERS_DONE = false;

  // must be a special browser page,
  // or a page that loaded everything before our most recent initialization
  if (POPUP_DATA.noTabData) {
    // replace inapplicable summary text with a Badger logo
    $('#blockedResourcesContainer').hide();
    $('#big-badger-logo').show();

    // hide inapplicable buttons
    $('#deactivate_site_btn').hide();
    $('#error').hide();

    // activate tooltips
    $('.tooltip').tooltipster();

    window.SLIDERS_DONE = true;

    return;
  }

  // revert any hiding/showing above for cases when refreshPopup gets called
  // more than once for the same popup, such as during functional testing
  $('#blockedResourcesContainer').show();
  $('#big-badger-logo').hide();
  $('#deactivate_site_btn').show();
  $('#error').show();

  // toggle activation buttons if privacy badger is not enabled for current url
  if (!POPUP_DATA.enabled) {
    $("#blockedResourcesContainer").hide();
    $("#activate_site_btn").show();
    $("#deactivate_site_btn").hide();
  }

  // if there is any saved error text, fill the error input with it
  if (POPUP_DATA.hasOwnProperty('errorText')) {
    $("#error_input").val(POPUP_DATA.errorText);
  }

  let origins = POPUP_DATA.origins;
  let originsArr = [];
  if (origins) {
    originsArr = Object.keys(origins);
  }

  if (!originsArr.length) {
    // hide the number of trackers and slider instructions message
    // if no sliders will be displayed
    $("#instructions-many-trackers").hide();

    // show "no trackers" message
    $("#instructions_no_trackers").show();

    // show the "no third party resources on this site" message
    $("#blockedResources").html(chrome.i18n.getMessage("popup_blocked"));

    // activate tooltips
    $('.tooltip').tooltipster();

    window.SLIDERS_DONE = true;

    return;
  }

  // Get containing HTML for domain list along with toggle legend icons.
  $("#blockedResources")[0].innerHTML = htmlUtils.getTrackerContainerHtml();

  // activate tooltips
  $('.tooltip').tooltipster();

  var printable = [];
  var nonTracking = [];
  originsArr = htmlUtils.sortDomains(originsArr);
  var num_trackers = 0;

  for (let i=0; i < originsArr.length; i++) {
    var origin = originsArr[i];
    var action = origins[origin];

    if (action == constants.NO_TRACKING) {
      nonTracking.push(origin);
      continue;
    }

    if (action != constants.DNT) {
      num_trackers++;
    }
    printable.push(
      htmlUtils.getOriginHtml(origin, action, action == constants.DNT)
    );
  }

  var nonTrackerText = chrome.i18n.getMessage("non_tracker");
  var nonTrackerTooltip = chrome.i18n.getMessage("non_tracker_tip");

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

  if (num_trackers === 0) {
    // hide multiple trackers message
    $("#instructions-many-trackers").hide();

    // show "no trackers" message
    $("#instructions_no_trackers").show();

  } else if (num_trackers == 1) {
    // hide multiple trackers message
    $("#instructions-many-trackers").hide();

    // show singular "tracker" message
    $("#instructions_one_tracker").show();

  } else {
    $('#instructions-many-trackers').html(chrome.i18n.getMessage(
      "popup_instructions", [
        num_trackers,
        "<a target='_blank' title='" + _.escape(chrome.i18n.getMessage("what_is_a_tracker")) + "' class='tooltip' href='https://www.eff.org/privacybadger/faq#What-is-a-third-party-tracker'>"
      ]
    )).find(".tooltip").tooltipster();
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

    // activate tooltips
    $('#blockedResourcesInner .tooltip:not(.tooltipstered)').tooltipster(
      htmlUtils.DOMAIN_TOOLTIP_CONF);

    if (printable.length) {
      requestAnimationFrame(renderDomains);
    } else {
      window.SLIDERS_DONE = true;
    }
  }
  requestAnimationFrame(renderDomains);
}

/**
 * Update the user preferences displayed in the domain list for this origin.
 * These UI changes will later be used to update user preferences data.
 *
 * @param {Event} event Click event triggered by user.
 */
function updateOrigin(event) {
  // get the origin and new action for it
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  var action = $elm.data('action');

  // replace the old action with the new one
  var $switchContainer = $elm.parents('.switch-container').first();
  $switchContainer.removeClass([
    constants.BLOCK,
    constants.COOKIEBLOCK,
    constants.ALLOW,
    constants.NO_TRACKING].join(" ")).addClass(action);
  var $clicker = $elm.parents('.clicker').first();
  htmlUtils.toggleBlockedStatus($clicker, action);

  // reinitialize the domain tooltip
  $clicker.find('.origin').tooltipster('destroy');
  $clicker.find('.origin').attr(
    'title',
    htmlUtils.getActionDescription(action, $clicker.data('origin'))
  );
  $clicker.find('.origin').tooltipster(htmlUtils.DOMAIN_TOOLTIP_CONF);

  // persist the change
  saveToggle($clicker);
}

/**
 * Save the user setting for a domain by messaging the background page.
 */
function saveToggle($clicker) {
  let origin = $clicker.attr("data-origin"),
    action;

  if ($clicker.hasClass(constants.BLOCK)) {
    action = constants.BLOCK;
  } else if ($clicker.hasClass(constants.COOKIEBLOCK)) {
    action = constants.COOKIEBLOCK;
  } else if ($clicker.hasClass(constants.ALLOW)) {
    action = constants.ALLOW;
  }

  if (action) {
    chrome.runtime.sendMessage({
      type: "savePopupToggle",
      origin: origin,
      action: action,
      tabId: POPUP_DATA.tabId
    });
  }
}

function getTab(callback) {
  // Temporary fix for Firefox Android
  if (!FirefoxAndroid.hasPopupSupport) {
    FirefoxAndroid.getParentOfPopup(callback);
    return;
  }

  chrome.tabs.query({active: true, lastFocusedWindow: true}, function(t) { callback(t[0]); });
}

/**
 * Workaround for geckodriver being unable to modify page globals.
 */
function setPopupData(data) {
  POPUP_DATA = data;
}

$(function () {
  getTab(function (tab) {
    chrome.runtime.sendMessage({
      type: "getPopupData",
      tabId: tab.id,
      tabUrl: tab.url
    }, (response) => {
      setPopupData(response);
      refreshPopup();
      init();
    });
  });
});
