$(function () {
  let already_set = false;

  $(".scroll-it").smoothScroll();

  $(window).scroll(function () {
    if (!already_set) {
      if ($(window).scrollTop() > 400) {
        already_set = true;
        chrome.runtime.sendMessage({
          type: "updateSettings",
          data: { seenComic: true }
        });
      }
    }
  });
});
