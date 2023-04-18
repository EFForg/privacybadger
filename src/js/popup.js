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

window.POPUP_INITIALIZED = false;
window.SLIDERS_DONE = false;

import constants from "./constants.js";
import FirefoxAndroid from "./firefoxandroid.js";
import htmlUtils from "./htmlutils.js";
import utils from "./utils.js";

let POPUP_DATA = {};

// domains with breakage notes,
// along with corresponding i18n locale message keys
let BREAKAGE_NOTE_DOMAINS = {
  "accounts.google.com": "google_signin_tooltip" // Google Sign-In
};

const DOMAIN_TOOLTIP_CONF = {
  maxWidth: 300,
  side: 'bottom',
};

/* if they aint seen the comic*/
function showNagMaybe() {
  var $nag = $("#instruction");
  var $outer = $("#instruction-outer");
  let intro_page_url = chrome.runtime.getURL("/skin/firstRun.html");

  function _setSeenComic(cb) {
    chrome.runtime.sendMessage({
      type: "updateSettings",
      data: { seenComic: true }
    }, cb);
  }

  function _setSeenLearningPrompt(cb) {
    chrome.runtime.sendMessage({
      type: "seenLearningPrompt"
    }, cb);
  }

  function _hideNag() {
    $nag.fadeOut();
    $outer.fadeOut();
  }

  function _showNag() {
    $nag.show();
    $outer.show();
    // Attach event listeners
    $('#fittslaw').on("click", function (e) {
      e.preventDefault();
      _setSeenComic(() => {
        _hideNag();
      });
    });
    $("#intro-reminder-btn").on("click", function () {
      // If there is a firstRun.html tab, switch to the tab.
      // Otherwise, create a new tab
      chrome.tabs.query({url: intro_page_url}, function (tabs) {
        if (tabs.length == 0) {
          chrome.tabs.create({
            url: intro_page_url
          });
        } else {
          chrome.tabs.update(tabs[0].id, {active: true}, function (tab) {
            chrome.windows.update(tab.windowId, {focused: true});
          });
        }
        _setSeenComic(() => {
          window.close();
        });
      });
    });
  }

  function _showError(error_text) {
    $('#instruction-text').hide();

    // if error is the 'unexpected error occurred' Firefox issue commonly associated with low disk space, show special message
    if (error_text == "An unexpected error occurred") {
      // replace current error text with this special message
      $('#error-text').show().html([
        chrome.i18n.getMessage("popup_error_text_low_disk_space_issue", [error_text]),
        chrome.i18n.getMessage("learn_more_link", ["<a href='https://privacybadger.org/#I-found-a-bug%21-What-do-I-do-now'>privacybadger.org</a>"]),
      ].join(" "));

    } else {
      $('#error-message').text(error_text);

      $('#error-text').show().find('a')
        .addClass('cta-button')
        .css({
          borderRadius: '3px',
          display: 'inline-block',
          padding: '5px',
          textDecoration: 'none',
          width: 'auto',
        });
    }

    $('#fittslaw').on("click", function (e) {
      e.preventDefault();
      _hideNag();
    });

    $nag.show();
    $outer.show();
  }

  function _showLearningPrompt() {
    $('#instruction-text').hide();

    $("#learning-prompt-btn").on("click", function () {
      chrome.tabs.create({
        url: "https://www.eff.org/badger-evolution"
      });
      _setSeenLearningPrompt(function () {
        window.close();
      });
    });

    $('#fittslaw').on("click", function (e) {
      e.preventDefault();
      _setSeenLearningPrompt(function () {
        _hideNag();
      });
    });

    $('#learning-prompt-div').show();
    $nag.show();
    $outer.show();
  }

  if (POPUP_DATA.criticalError) {
    _showError(POPUP_DATA.criticalError);

  } else if (POPUP_DATA.showLearningPrompt) {
    _showLearningPrompt();

  } else if (!POPUP_DATA.settings.seenComic) {
    chrome.tabs.query({active: true, currentWindow: true}, function (focusedTab) {
      // Show the popup instruction if the active tab is not firstRun.html page
      if (!focusedTab[0].url.startsWith(intro_page_url)) {
        _showNag();
      }
    });

  }
}

/**
 * Init function. Showing/hiding popup.html elements and setting up event handler
 */
function init() {
  showNagMaybe();

  $("#activate_site_btn").on("click", activateOnSite);
  $("#deactivate_site_btn").on("click", deactivateOnSite);

  $('#error_input').on('input propertychange', function() {
    // No easy way of sending message on popup close, send message for every change
    chrome.runtime.sendMessage({
      type: 'saveErrorText',
      tabId: POPUP_DATA.tabId,
      errorText: $("#error_input").val()
    });
  });

  $("#error").on("click", function() {
    $('#overlay').toggleClass('active');
  });
  $("#report-cancel").on("click", function() {
    clearSavedErrorText();
    closeOverlay();
  });
  $("#report-button").on("click", function() {
    $(this).prop("disabled", true);
    $("#report-cancel").prop("disabled", true);
    send_error($("#error_input").val());
  });
  $("#report_close").on("click", function (e) {
    e.preventDefault();
    clearSavedErrorText();
    closeOverlay();
  });

  $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
  $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);

  $("#version").text(
    chrome.i18n.getMessage("version", chrome.runtime.getManifest().version)
  );

  // add event listeners for click-to-expand blocked resources popup section
  $('#tracker-list-header').on('click', toggleBlockedResourcesHandler);

  // add event listeners for click-to-expand first party protections popup section
  $('#firstparty-protections-header').on('click', toggleFirstPartyInfoHandler);

  // show firstparty protections message if current tab is in our content scripts
  if (POPUP_DATA.enabled && POPUP_DATA.isOnFirstParty) {
    $("#firstparty-protections-container").show();
    $('#expand-firstparty-popup').show();
  }

  // improve on Firefox's built-in options opening logic
  if (typeof browser == "object" && typeof browser.runtime.getBrowserInfo == "function") {
    browser.runtime.getBrowserInfo().then(function (info) {
      if (info.name == "Firefox") {
        $("#options").on("click", function (e) {
          e.preventDefault();
          openPage(chrome.runtime.getURL("/skin/options.html"));
        });
        $("#help").on("click", function (e) {
          e.preventDefault();
          openPage(this.getAttribute('href'));
        });
      }
    });
  }

  $("#share").on("click", function (e) {
    e.preventDefault();
    share();
  });
  $("#share_close").on("click", function (e) {
    e.preventDefault();
    $("#share_overlay").toggleClass('active', false);
  });
  $("#copy-button").on("click", function() {
    $("#share_output").select();
    document.execCommand('copy');
    $(this).text(chrome.i18n.getMessage("copy_button_copied"));
  });

  $('html').css({
    overflow: 'visible',
    visibility: 'visible'
  });

  window.POPUP_INITIALIZED = true;
}

function openPage(url) {
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

    window.close();
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
  $("#report-success").hide();
  $("#report-fail").hide();
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

      // adjust action names for error reporting
      if (action == constants.USER_ALLOW) {
        action = "usernoaction";
      } else if (action == constants.USER_BLOCK) {
        action = "userblock";
      } else if (action == constants.USER_COOKIEBLOCK) {
        action = "usercookieblock";
      } else if (action == constants.ALLOW) {
        action = "noaction";
      } else if (action == constants.BLOCK || action == constants.COOKIEBLOCK) {
        // no need to adjust action
      } else if (action == constants.DNT || action == constants.NO_TRACKING) {
        action = "notracking";
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
      $("#report-success").slideDown();

      clearSavedErrorText();

      setTimeout(function() {
        $("#report-button").prop("disabled", false);
        $("#report-cancel").prop("disabled", false);
        closeOverlay();
      }, 3000);
    });

    sendReport.fail(function() {
      $("#report-fail").slideDown();

      setTimeout(function() {
        $("#report-button").prop("disabled", false);
        $("#report-cancel").prop("disabled", false);
        $("#report-fail").slideUp();
      }, 3000);
    });
  });
}

/**
 * activate PB for site event handler
 */
function activateOnSite() {
  $("#activate_site_btn").prop("disabled", true);

  chrome.runtime.sendMessage({
    type: "reenableOnSiteFromPopup",
    tabHost: POPUP_DATA.tabHost,
    tabId: POPUP_DATA.tabId,
    tabUrl: POPUP_DATA.tabUrl
  }, () => {
    // reload tab and close popup
    chrome.tabs.reload(POPUP_DATA.tabId);
    window.close();
  });
}

/**
 * de-activate PB for site event handler
 */
function deactivateOnSite() {
  $("#deactivate_site_btn").prop("disabled", true);

  chrome.runtime.sendMessage({
    type: "disableOnSiteFromPopup",
    tabHost: POPUP_DATA.tabHost,
    tabId: POPUP_DATA.tabId,
    tabUrl: POPUP_DATA.tabUrl
  }, () => {
    // reload tab and close popup
    chrome.tabs.reload(POPUP_DATA.tabId);
    window.close();
  });
}

/**
 * Open the share overlay
 */
function share() {
  $("#share_overlay").toggleClass('active');
  let share_msg = chrome.i18n.getMessage("share_base_message");

  // only add language about found trackers if we actually found trackers
  // (but regardless of whether we are actually blocking them)
  if (POPUP_DATA.noTabData) {
    $("#share_output").val(share_msg);
    return;
  }

  let origins = POPUP_DATA.origins;
  let originsArr = [];
  if (origins) {
    originsArr = Object.keys(origins);
  }

  if (!originsArr.length) {
    $("#share_output").val(share_msg);
    return;
  }

  originsArr = htmlUtils.sortDomains(originsArr);
  let tracking = [];

  for (let origin of originsArr) {
    let action = origins[origin];

    if (action == constants.BLOCK || action == constants.COOKIEBLOCK) {
      tracking.push(origin);
    }
  }

  if (tracking.length) {
    share_msg += "\n\n";
    share_msg += chrome.i18n.getMessage(
      "share_tracker_header", [tracking.length, POPUP_DATA.tabHost]);
    share_msg += "\n\n";
    share_msg += tracking.join("\n");
  }
  $("#share_output").val(share_msg);
}

/**
 * Click handlers for showing/hiding the blocked resources section
 */
function toggleBlockedResourcesHandler(e) {
  if (e.target.nodeName.toLowerCase() == 'a') {
    // don't toggle contents when clicking links in the header
    return;
  }
  if ($("#expand-blocked-resources").is(":visible")) {
    $("#collapse-blocked-resources").show();
    $("#expand-blocked-resources").hide();
    $("#blockedResources").slideDown();
    chrome.runtime.sendMessage({
      type: "updateSettings",
      data: { showExpandedTrackingSection: true }
    });
  } else {
    $("#collapse-blocked-resources").hide();
    $("#expand-blocked-resources").show();
    $("#blockedResources").slideUp();
    chrome.runtime.sendMessage({
      type: "updateSettings",
      data: { showExpandedTrackingSection: false }
    });
  }
}

/**
 * Click handler for showing/hiding the firstparty popup info text
 */
function toggleFirstPartyInfoHandler() {
  if ($('#collapse-firstparty-popup').is(":visible")) {
    $("#collapse-firstparty-popup").hide();
    $("#expand-firstparty-popup").show();
    $("#instructions-firstparty-description").slideUp();
  } else {
    $("#collapse-firstparty-popup").show();
    $("#expand-firstparty-popup").hide();
    $("#instructions-firstparty-description").slideDown();
  }
}

/**
 * Handler to undo user selection for a tracker
 */
function revertDomainControl(event) {
  event.preventDefault();

  let origin = $(event.target).parent().data('origin');

  chrome.runtime.sendMessage({
    type: "revertDomainControl",
    origin: origin
  }, () => {
    chrome.tabs.reload(POPUP_DATA.tabId);
    window.close();
  });
}

/**
 * Tooltip that explains how to enable signing into websites with Google.
 */
function createBreakageNote(domain, i18n_message_key) {
  let $slider_allow = $(`#blockedResourcesInner label[for="allow-${domain.replace(/\./g, '-')}"]`);

  // first remove the Allow tooltip so that future tooltipster calls
  // return the tooltip we want (the breakage note, not Allow)
  $slider_allow.tooltipster('destroy').tooltipster({
    autoClose: false,
    content: chrome.i18n.getMessage(i18n_message_key),
    functionReady: function (tooltip) {
      // record that this breakage note was shown
      chrome.runtime.sendMessage({
        type: "seenBreakageNote",
        domain
      });

      // close on tooltip click/tap
      $(tooltip.elementTooltip()).on('click', function (e) {
        e.preventDefault();
        tooltip.hide();
      });
      // also when Report Broken Site or Share overlays get activated
      $('#error, #share').off('click.breakage-note').on('click.breakage-note', function (e) {
        e.preventDefault();
        tooltip.hide();
      });
    },
    interactive: true,
    position: ['top'],
    trigger: 'custom',
    theme: 'tooltipster-badger-breakage-note'

  // now restore the Allow tooltip
  }).tooltipster(Object.assign({}, DOMAIN_TOOLTIP_CONF, {
    content: chrome.i18n.getMessage('domain_slider_allow_tooltip'),
    multiple: true
  }));

  if (POPUP_DATA.settings.seenComic && !POPUP_DATA.showLearningPrompt && !POPUP_DATA.criticalError) {
    $slider_allow.tooltipster('show');
  }
}

/**
 * Refresh the content of the popup window
 *
 * @param {Integer} tabId The id of the tab
 */
function refreshPopup() {
  window.SLIDERS_DONE = false;

  // must be a special browser page,
  if (POPUP_DATA.noTabData) {
    // show the "nothing to do here" message
    $('#blockedResourcesContainer').hide();
    $('#special-browser-page').show();

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
  $('#special-browser-page').hide();
  $('#deactivate_site_btn').show();
  $('#error').show();

  // toggle activation buttons if privacy badger is not enabled for current url
  if (!POPUP_DATA.enabled) {
    $("#blockedResourcesContainer").hide();
    $("#activate_site_btn").show();
    $("#deactivate_site_btn").hide();
    $("#disabled-site-message").show();
    $("#title").addClass("faded-bw-color-scheme");
  }

  // if there is any saved error text, fill the error input with it
  if (utils.hasOwn(POPUP_DATA, 'errorText')) {
    $("#error_input").val(POPUP_DATA.errorText);
  }
  // show error layout if the user was writing an error report
  if (utils.hasOwn(POPUP_DATA, 'errorText') && POPUP_DATA.errorText) {
    $('#overlay').toggleClass('active');
  }

  // show sliders when sliders were shown last,
  // or when there is a visible breakage note,
  // or when there is at least one breakage warning
  if (POPUP_DATA.settings.showExpandedTrackingSection || (
    (POPUP_DATA.settings.seenComic && !POPUP_DATA.showLearningPrompt && !POPUP_DATA.criticalError) &&
    Object.keys(BREAKAGE_NOTE_DOMAINS).some(d => (
      (POPUP_DATA.origins[d] == constants.BLOCK ||
        POPUP_DATA.origins[d] == constants.COOKIEBLOCK) &&
      !POPUP_DATA.shownBreakageNotes.includes(d)))
  ) || (
    POPUP_DATA.cookieblocked && Object.keys(POPUP_DATA.cookieblocked).some(
      d => POPUP_DATA.origins[d] == constants.USER_BLOCK)
  )) {
    $('#expand-blocked-resources').hide();
    $('#collapse-blocked-resources').show();
    $('#blockedResources').show();

  } else {
    $('#expand-blocked-resources').show();
    $('#collapse-blocked-resources').hide();
    $('#blockedResources').hide();
  }

  let origins = POPUP_DATA.origins;
  let originsArr = [];
  if (origins) {
    originsArr = Object.keys(origins);
  }

  if (!originsArr.length) {
    // show "no trackers" message
    $('#blockedResources').hide();
    $("#instructions-no-trackers").show();

    if (POPUP_DATA.settings.learnLocally && POPUP_DATA.settings.showNonTrackingDomains) {
      // show the "no third party resources on this site" message
      $("#no-third-parties").show();
    }

    // activate tooltips
    $('.tooltip').tooltipster();

    window.SLIDERS_DONE = true;

    return;
  }

  let printable = [],
    printableWarningSliders = [];
  let unblockedTrackers = [];
  let nonTracking = [];
  originsArr = htmlUtils.sortDomains(originsArr);

  for (let fqdn of originsArr) {
    let action = origins[fqdn];

    if (action == constants.NO_TRACKING) {
      nonTracking.push(fqdn);
    } else if (action == constants.ALLOW) {
      unblockedTrackers.push(fqdn);
    } else {
      let show_breakage_warning = (
        action == constants.USER_BLOCK &&
        utils.hasOwn(POPUP_DATA.cookieblocked, fqdn)
      );
      let show_breakage_note = false;
      if (!show_breakage_warning) {
        show_breakage_note = (utils.hasOwn(BREAKAGE_NOTE_DOMAINS, fqdn) &&
          !POPUP_DATA.shownBreakageNotes.includes(fqdn) &&
          (action == constants.BLOCK || action == constants.COOKIEBLOCK));
      }
      let slider_html = htmlUtils.getOriginHtml(fqdn, action,
        show_breakage_warning, show_breakage_note, POPUP_DATA.blockedFpScripts[fqdn]);
      if (show_breakage_warning) {
        printableWarningSliders.push(slider_html);
      } else if (show_breakage_note) {
        printableWarningSliders.unshift(slider_html);
      } else {
        printable.push(slider_html);
      }
    }
  }

  // show breakage warning sliders at the top of the list
  printable = printableWarningSliders.concat(printable);

  if (POPUP_DATA.settings.learnLocally && unblockedTrackers.length) {
    printable.push(
      '<div class="clicker tooltip" id="not-yet-blocked-header" title="' +
      chrome.i18n.getMessage("intro_not_an_adblocker_paragraph") +
      '" data-tooltipster=\'{"side":"top"}\'>' +
      chrome.i18n.getMessage("not_yet_blocked_header") +
      '</div>'
    );
    unblockedTrackers.forEach(domain => {
      printable.push(
        htmlUtils.getOriginHtml(domain, constants.ALLOW)
      );
    });
  }

  if (POPUP_DATA.settings.learnLocally && POPUP_DATA.settings.showNonTrackingDomains && nonTracking.length) {
    printable.push(
      '<div class="clicker tooltip" id="non-trackers-header" title="' +
      chrome.i18n.getMessage("non_tracker_tip") +
      '" data-tooltipster=\'{"side":"top"}\'>' +
      chrome.i18n.getMessage("non_tracker") +
      '</div>'
    );
    for (let i = 0; i < nonTracking.length; i++) {
      printable.push(
        htmlUtils.getOriginHtml(nonTracking[i], constants.NO_TRACKING)
      );
    }
  }

  // activate tooltips
  $('.tooltip').tooltipster();

  if (POPUP_DATA.trackerCount === 0) {
    // show "no trackers" message
    $("#instructions-no-trackers").show();

    if (printable.length) {
      // make sure to show domain list
      // (there is no toggle button when nothing was blocked)
      $('#blockedResources').show();
    }

  } else {
    $('#tracker-list-header').show();
    $('#instructions-many-trackers').html(chrome.i18n.getMessage(
      "popup_instructions", [
        POPUP_DATA.trackerCount,
        "<a target='_blank' title='" + htmlUtils.escape(chrome.i18n.getMessage("what_is_a_tracker")) + "' class='tooltip' href='https://privacybadger.org/#What-is-a-third-party-tracker'>"
      ]
    )).find(".tooltip").tooltipster();
  }

  function renderDomains() {
    const CHUNK = 1;

    let $printable = $(printable.splice(0, CHUNK).join(""));

    // Hide elements for removing origins (controlled from the options page).
    // Popup shows what's loaded for the current page so it doesn't make sense
    // to have removal ability here.
    $printable.find('.removeOrigin').hide();

    $printable.appendTo('#blockedResourcesInner');

    // activate tooltips
    $printable.find('.tooltip:not(.tooltipstered)').tooltipster(DOMAIN_TOOLTIP_CONF);
    if ($printable.hasClass('breakage-note')) {
      let domain = $printable[0].dataset.origin;
      if (!POPUP_DATA.shownBreakageNotes.includes(domain)) {
        createBreakageNote(domain, BREAKAGE_NOTE_DOMAINS[domain]);
      }
    }

    if (printable.length) {
      requestAnimationFrame(renderDomains);
    } else {
      $('#not-yet-blocked-header').tooltipster();
      $('#non-trackers-header').tooltipster();
      window.SLIDERS_DONE = true;
    }
  }

  if (printable.length) {
    requestAnimationFrame(renderDomains);
  } else {
    window.SLIDERS_DONE = true;
  }
}

/**
 * Update the user preferences displayed in the domain list for this origin.
 * These UI changes will later be used to update user preferences data.
 *
 * @param {Event} event Click event triggered by user.
 */
function updateOrigin() {
  // get the origin and new action for it
  let $radio = $(this),
    action = $radio.val(),
    $switchContainer = $radio.parents('.switch-container').first();

  // update slider color via CSS
  $switchContainer.removeClass([
    constants.BLOCK,
    constants.COOKIEBLOCK,
    constants.ALLOW,
    constants.NO_TRACKING].join(" ")).addClass(action);

  let $clicker = $radio.parents('.clicker').first(),
    origin = $clicker.data('origin'),
    show_breakage_warning = (
      action == constants.BLOCK &&
      utils.hasOwn(POPUP_DATA.cookieblocked, origin)
    );

  htmlUtils.toggleBlockedStatus($clicker, true, show_breakage_warning);

  // reinitialize the domain tooltip
  $clicker.find('.origin-inner').tooltipster('destroy');
  $clicker.find('.origin-inner').attr(
    'title', htmlUtils.getActionDescription(action, origin));
  $clicker.find('.origin-inner').tooltipster(DOMAIN_TOOLTIP_CONF);

  // persist the change
  saveToggle(origin, action);
}

/**
 * Save the user setting for a domain by messaging the background page.
 */
function saveToggle(origin, action) {
  chrome.runtime.sendMessage({
    type: "savePopupToggle",
    origin,
    action,
    tabId: POPUP_DATA.tabId
  });
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
  $.tooltipster.setDefaults(htmlUtils.TOOLTIPSTER_DEFAULTS);

  function getPopupData(tab) {
    chrome.runtime.sendMessage({
      type: "getPopupData",
      tabId: tab.id,
      tabUrl: tab.url
    }, (response) => {
      if (!response) {
        // event page/extension service worker is still starting up, retry
        // async w/ non-zero delay to avoid locking up the messaging channel
        setTimeout(function () {
          getPopupData(tab);
        }, 10);
        return;
      }
      setPopupData(response);
      refreshPopup();
      init();
    });
  }

  getTab(function (tab) {
    getPopupData(tab);
  });
});

// expose certain functions to Selenium tests
window.setPopupData = setPopupData;
window.refreshPopup = refreshPopup;
window.showNagMaybe = showNagMaybe;
