(function($) {

$(window).on("load", function () {
  $('.jcarousel').jcarousel();

  $('.jcarousel-control-prev')
    .on('jcarouselcontrol:active', function() {
      $(this).removeClass('inactive');
    })
    .on('jcarouselcontrol:inactive', function() {
      $(this).addClass('inactive');
    })
    .jcarouselControl({
      target: '-=1'
    });

  $('.jcarousel-control-next')
    .on('jcarouselcontrol:active', function() {
      $(this).removeClass('inactive');
    })
    .on('jcarouselcontrol:inactive', function() {
      $(this).addClass('inactive');
    })
    .jcarouselControl({
      target: '+=1'
    });

  $('.jcarousel-pagination')
    .on('jcarouselpagination:active', 'a', function() {
      $(this).addClass('active');
    })
    .on('jcarouselpagination:inactive', 'a', function() {
      $(this).removeClass('active');
    })
    .jcarouselPagination();

  $(document).on('keyup', function(e) {
    var key = e.which || e.keyChar || e.keyCode;
    if (key == 37) { // Left arrow
      $('.jcarousel').jcarousel('scroll', '-=1');
    } else if (key == 39) { // Right arrow
      $('.jcarousel').jcarousel('scroll', '+=1');
      setSeenComic();
    }
  });

  $(".jcarousel-control-next").on("click", setSeenComic);
  $(".jcarousel-pagination").on("click", setSeenComic);

  function setSeenComic() {
    var badger = chrome.extension.getBackgroundPage().badger;
    var settings = badger.storage.getBadgerStorageObject("settings_map");
    settings.setItem("seenComic", true);
  }

  $.getJSON("/data/seed.json", function(seed) {
    var badger = chrome.extension.getBackgroundPage().badger;
    actionMap = badger.storage.getBadgerStorageObject("action_map");
    actionMap.merge(seed["action_map"]); 
    snitchMap = badger.storage.getBadgerStorageObject("snitch_map");
    snitchMap.merge(seed["snitch_map"]); 
  });
});

})(jQuery);
