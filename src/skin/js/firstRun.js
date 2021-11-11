(function($) {

$(window).on("load", function () {

  function setSeenComic() {
    var badger = chrome.extension.getBackgroundPage().badger;
    var settings = badger.getSettings();
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

  // detect user's browser and replace images for walkthru on how to open the popup
  function setPopupWalkthroughToBrowserType() {
    // paths to the various images specific to each browser type
    let browserImageSrcMap = {
      chrome1: "images/extension-icon-in-chrome-1.png",
      chrome2: "images/extension-icon-in-chrome-2.png",
      chrome3: "images/extension-icon-in-chrome-3.png",
      edge: "images/extension-icon-in-edge.png",
      firefox: "images/extension-icon-in-firefox.png",
      firefoxAndroid1: "images/firefox-android-searchbar.png",
      firefoxAndroid2: "images/firefox-android-addons-menu.png",
      firefoxAndroid3: "images/firefox-android-extension-icon.png",
      opera1: "images/extension-icon-in-opera-1.png",
      opera2: "images/extension-icon-in-opera-2.png",
      opera3: "images/extension-icon-in-opera-3.png"
    };

    // determine browser type by user agent
    let browser;
    if (navigator && navigator.userAgent) {
      const ua = navigator.userAgent;
      if (ua.match(/Android.+Firefox/i)) {
        browser = 'firefox-on-android';
      } else if (ua.match(/Firefox/i)) {
        browser = 'firefox';
      } else if (ua.match(/OPR|opera/i)) {
        browser = 'opera';
      } else if (ua.match(/chrome\/.+edge?\//i)) {
        browser = 'edge';
      } else if (ua.match(/chrome/i)) {
        browser = 'chrome';
      }
    }

    let popupWalkthruImg1 = $("#how-to-open-popup-1");
    let popupWalkthruImg2 = $("#how-to-open-popup-2");
    let popupWalkthruImg3 = $("#how-to-open-popup-3");

    // helper function to quickly set the image src paths to ones defined in browserImageSrcMap
    function setSrcs (path1, path2, path3) {
      popupWalkthruImg1.attr('src', path1);
      popupWalkthruImg2.attr('src', path2);
      popupWalkthruImg3.attr('src', path3);
    }

    // set popup-walkthrough images on page based on browser type
    switch (browser) {
    case 'chrome':
      setSrcs(browserImageSrcMap.chrome1, browserImageSrcMap.chrome2, browserImageSrcMap.chrome3);
      break;
    case 'edge':
      setSrcs('', browserImageSrcMap.edge, '');
      break;
    case 'firefox':
      setSrcs('', browserImageSrcMap.firefox, '');
      break;
    case 'firefox-on-android':
      setSrcs(browserImageSrcMap.firefoxAndroid1, browserImageSrcMap.firefoxAndroid2, browserImageSrcMap.firefoxAndroid3);
      break;
    case 'opera':
      setSrcs(browserImageSrcMap.opera1, browserImageSrcMap.opera2, browserImageSrcMap.opera3);
      break;
    }
  }
  setPopupWalkthroughToBrowserType();
});


}(jQuery));
