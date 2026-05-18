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
  function renderNudge() {
    $("body").addClass('unpinned-chrome');
    initAnimationToggle();
  }

  // chrome.action is only available in MV3 and chrome.browserAction is only available in <= MV2
  // chrome.browserAction.getUserSettings doesn't exist in MV2 Chrome but does in Firefox
  let is_chromium_mv3 = !!chrome.action;
  let is_chromium_mv2 = chrome.browserAction && !chrome.browserAction.getUserSettings;
  if (is_chromium_mv2) {
    renderNudge();
  } else if (is_chromium_mv3) {
    // Don't render pinning section if PB is already pinned
    chrome.action.getUserSettings(userSettings => {
      if (!userSettings.isOnToolbar) {
        renderNudge();
      }
    });
  }
}

function initAnimationToggle() {
  function showAnimation() {
    $("#pinning-instructions-animation").show();
    $("#pinning-instructions-reduced-motion").hide();
    $("#toggle-animation-icon").text("\u23F8"); // Pause icon
    $("#toggle-animation-label").text(chrome.i18n.getMessage("intro_animation_button_stop"));
  }
  function hideAnimation() {
    $("#pinning-instructions-animation").hide();
    $("#pinning-instructions-reduced-motion").show();
    $("#toggle-animation-icon").text("\u25B6"); // Play icon
    $("#toggle-animation-label").text(chrome.i18n.getMessage("intro_animation_button_play"));
  }

  let prefers_reduced_motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Set initial animation state based on user's reduced motion setting
  if (prefers_reduced_motion) {
    hideAnimation();
  } else {
    showAnimation();
  }

  $("#toggle-animation-btn").on("click", function () {
    let animation_visible = $("#pinning-instructions-animation").is(":visible");
    if (animation_visible) {
      hideAnimation();
    } else {
      showAnimation();
    }
  });
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
