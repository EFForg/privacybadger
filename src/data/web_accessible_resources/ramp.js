// https://developers.playwire.com/api/docs/ads/getting-started-ads.html
// https://github.com/EFForg/privacybadger/pull/2865#issuecomment-1355151256
(function () {
  function noopfn() {}
  function checkForOnReady() {
    if (!window.ramp) {
      window.ramp = {};
    }
    window.ramp.addUnits = () => new Promise(noopfn);
    window.ramp.displayUnits = noopfn;
    window.ramp.destroyUnits = noopfn;
    if (typeof window.ramp.onReady == "function") {
      window.ramp.onReady();
    }
  }
  setTimeout(checkForOnReady, 10);
})();
