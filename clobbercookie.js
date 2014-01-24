// Clobber cookies, using a function closure to keep the dummy private
alert('FUCKITY HI');
var code = 
  'var dummyCookie = "x=y";' +
  'document.__defineSetter__("cookie", function(value) { alert("in setter"); return dummyCookie; });' +
  'document.__defineGetter__("cookie", function() { alert("in getter"); return dummyCookie; });';

var script = document.createElement('script');
script.appendChild(document.createTextNode(code));
(document.head || document.documentElement).appendChild(script);
script.parentNode.removeChild(script);
// Clobber local storage, using a function closure to keep the dummy private
/*(function() {
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
})(); */
