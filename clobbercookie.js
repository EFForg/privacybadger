var dummyCookie = "";
/*Object.defineProperty(document, "cookie", {
  __proto__: null,
  configurable: false,
  get: function () {
    return dummyCookie;
  },
  set: function (newValue) {
    console.log("Clobbered an attempt to set cookie");
    dummyCookie = newValue;
  }
});*/
/*
// Clobber local storage, using a function closure to keep the dummy private
(function() {
  var dummyLocalStorage = { };
  Object.defineProperty(window, "localStorage", {
    __proto__: null,
    configurable: false,
    get: function () {
      return dummyLocalStorage;
    },
    set: function (newValue) {
      // Do nothing
    }
  });
})();
*/