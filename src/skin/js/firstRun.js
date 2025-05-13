function initWelcomePage() {
  let already_set = false;

  $(".scroll-it").smoothScroll();

  $(window).scroll(function () {
    if (already_set) {
      return;
    }
    if ($(window).scrollTop() > 400) {
      already_set = true;
      chrome.runtime.sendMessage({
        type: "updateSettings",
        data: { seenComic: true }
      });
    }
  });
}

function initPinNudge() {
  function hideNudge() {
    $("body").css('overflow', 'auto');
    $("#pin-nudge").fadeOut();
    $("#overlay").fadeOut();
    document.removeEventListener("dblclick", dblClickHandler);
    document.removeEventListener("keydown", keydownHandler);
  }

  function dblClickHandler(e) {
    // Hide the pin nudge when a user clicks outside the popup
    if (!document.getElementById('pin-nudge').contains(e.target)) {
      hideNudge();
    }
  }

  function keydownHandler(e) {
    // Hide the pin nudge when a user presses 'Esc'
    if (e.keyCode === 27 && $('#pin-nudge').css('display') != 'none') {
      hideNudge();
    } else if (e.keyCode === 9) {
      // Trap focus within the popup
      $("#pin-nudge").trigger("focus");
      e.preventDefault();
    }
  }

  let interval_id;
  // Auto-dismiss the nudge once user pins Privacy Badger
  async function checkIsPinned() {
    let userSettings = await chrome.action.getUserSettings();
    if (userSettings.isOnToolbar) {
      hideNudge();
      clearInterval(interval_id);
    }
  }

  function renderNudge() {
    // switch the instructional graphic for Opera
    if (window.navigator.userAgent.match(/OPR\//)) {
      $('#pin-image').attr("src", "images/pinning-instructions-opera.png");
      // don't fix the tail if already fixed for RTL
      if ($('#pin-nudge-tail').css('left') != '10px') {
        $('#pin-nudge-tail').css({
          left: 'unset',
          right: '10px'
        });
      }
    }

    $("#pin-nudge-text").html(
      chrome.i18n.getMessage("intro_pin_nudge",
        [chrome.i18n.getMessage("popup_disable_for_site")]));

    $("#pin-nudge").show();

    $("#overlay").show();
    $("body").css('overflow', 'hidden');

    document.addEventListener("dblclick", dblClickHandler);
    document.addEventListener("keydown", keydownHandler);
  }

  // Don't show the pin nudge in Firefox because extensions are pinned automatically
  // chrome.action is only available in MV3 and chrome.browserAction is only available in <= MV2
  // chrome.browserAction.getUserSettings doesn't exist in MV2 but does in Firefox
  let is_chromium_mv3 = !!chrome.action;
  let is_chromium_mv2 = chrome.browserAction && !chrome.browserAction.getUserSettings;
  if (is_chromium_mv2) {
    renderNudge();
  } else if (is_chromium_mv3) {
    chrome.action.getUserSettings(userSettings => {
      if (!userSettings.isOnToolbar) {
        renderNudge();

        // For Chromium, we can only check if PB is pinned in MV3
        interval_id = setInterval(() => checkIsPinned(), 1000);
      }
    });
  }
}

$(function () {
  initWelcomePage();

  // Don't show the pin nudge on Android devices, where it's not applicable
  if (chrome.runtime.getPlatformInfo) {
    chrome.runtime.getPlatformInfo((info) => {
      if (!info || info.os != "android") {
        initPinNudge();
      }
    });
  } else {
    initPinNudge();
  }
});
