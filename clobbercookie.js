// Clobber cookies, using a function closure to keep the dummy private
(function() {
  var dummyCookie = "x=y";
  alert("help I'm stuck in a closure");
  document.__defineSetter__("cookie", function(value) {
    //dummyCookie = value;
    return dummyCookie;
  });
  document.__defineGetter__("cookie", function() {
    alert("in getter");
    return dummyCookie;
  });
})();
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
