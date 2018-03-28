(function($) {

$(window).on("load", function () {

  function setSeenComic() {
    var badger = chrome.extension.getBackgroundPage().badger;
    var settings = badger.storage.getBadgerStorageObject("settings_map");
    settings.setItem("seenComic", true);
  }
  setSeenComic;
  $(".scroll-it").smoothScroll();
});

})(jQuery);
