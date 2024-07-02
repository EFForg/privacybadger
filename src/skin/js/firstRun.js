$(function () {
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

  function hideNudgeOverlay() {
    $("body").css('overflow', 'auto');
    $("#pin-nudge").fadeOut();
    $("#overlay").fadeOut();
    document.removeEventListener("click", clickHandler);
    document.removeEventListener("keydown", keydownHandler);
  }

  function clickHandler(e) {
    // Hide the pin nudge when a user clicks outside the popup
    if (!document.getElementById('pin-nudge').contains(e.target)) {
      hideNudgeOverlay();
    }
  }

  function keydownHandler(e) {
    // Hide the pin nudge when a user presses 'Esc'
    if (e.keyCode === 27) {
      hideNudgeOverlay();
    } else if (e.keyCode === 9) {
      // Trap focus within the popup
      $("#dismiss-nudge").trigger("focus");
      e.preventDefault();
    }
  }

  // Don't show the pin nudge in Firefox because extensions are pinned automatically
  // chrome.action is only available in MV3 and chrome.browserAction is only available in <= MV2
  // chrome.browserAction.getUserSettings doesn't exist in MV2 but does in Firefox
  let is_chromium_mv3 = !!chrome.action;
  let is_chromium_mv2 = chrome.browserAction && !chrome.browserAction.getUserSettings;
  if (is_chromium_mv2 || is_chromium_mv3) {
    $("#pin-nudge-text").html(chrome.i18n.getMessage("intro_pin_nudge", [chrome.i18n.getMessage("popup_disable_for_site")]));
    $("#pin-nudge").show();
    $("#overlay").show();
    $("body").css('overflow', 'hidden');
    document.addEventListener("click", clickHandler);
    document.addEventListener("keydown", keydownHandler);
  }

  $("#dismiss-nudge").on("click", function (e) {
    e.preventDefault();
    hideNudgeOverlay();
  });

  let interval_id;
  // Auto-dismiss the nudge once user pins Privacy Badger
  async function checkIsPinned() {
    let userSettings = await chrome.action.getUserSettings();
    if (userSettings.isOnToolbar) {
      hideNudgeOverlay();
      clearInterval(interval_id);
    }
  }

  // For Chromium, we can only check if PB is pinned in MV3
  if (is_chromium_mv3) {
    interval_id = setInterval(() => checkIsPinned(), 1000);
  }
});
