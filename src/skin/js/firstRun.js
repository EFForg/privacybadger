(function($) {

$(window).on("load", function () {

  function setSeenComic() {
    var badger = chrome.extension.getBackgroundPage().badger;
    var settings = badger.storage.getBadgerStorageObject("settings_map");
    settings.setItem("seenComic", true);
  }

  $(".scroll-it").smoothScroll();

  var alreadySet = false;
  $(window).scroll(function () {
    if (!alreadySet) {
      if ($(window).scrollTop() > 400) {
        alreadySet = true;
        setSeenComic();
      }
    }
  });
});


})(jQuery);
