/**
 * Basic RPC for calling methods in the background context. This is needed so
 * the popup can communicate with the background context when it is on an
 * incognito window in Firefox.
 *
 * Names in the `defaultMethods` set are added to the client object, but with the
 * leftmost part removed. So for example if you have:
 *
 * let defaultMethods = new Set(['foo.baz.qux']);
 *
 * Then the client gets a method that can be called like:
 *
 * client.baz.qux(whatever, callback);  // optional callbacks are supported
 *
 * This calls a function in the background context like:
 *
 * foo.baz.qux(whatever);
 *
 * The result is returned to the client as a promise like:
 *
 * callback(foo.baz.qux(whatever));
 */
require.scopes.messages = (() => {
/**
 * Methods the client and server understand. These must resolve to a function in the background context.
 */
let defaultMethods = new Set([
  'badger.isPrivacyBadgerEnabled',
  'badger.isPrivacyBadgerEnabledForURL',
  'badger.getAllOriginsForTab',
  'badger.enablePrivacyBadgerForOrigin',
  'badger.disablePrivacyBadgerForOrigin',
  'badger.enablePrivacyBadgerForOriginFromURL',
  'badger.disablePrivacyBadgerForOriginFromURL',
  'badger.refreshIconAndContextMenu',
  'badger.storage.revertUserAction',
  'badger.storage.getBestAction',
  'badger.settings.getItem',
  'badger.settings.setItem',
  'badger.saveAction',
  'badger.extractHostFromURL',
]);

/**
 * Listen for messages from the client. Call requested functions and return the result.
 */
function Listener(methods) {
  if (!methods) {
    methods = defaultMethods;
  }
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (methods.has(request.method)) {
        let arr = request.method.split('.'),
          last = arr.pop(),
          base = window[arr.shift()];
        if (arr) {
          base = arr.reduce((o, i) => o[i], base);
        }
        sendResponse(base[last].apply(base, request.args));
      }
    }
  );
}

/**
 * Build a remote function from a dottedName
 */
function _makeMethodCaller(client, dottedName) {
  let arr = dottedName.split('.'),
    part = client;
  // walk out from the client up to the 2nd to last property in the array
  arr.shift();
  for (let i = 0; i < arr.length - 1; i++) {
    if (typeof part[arr[i]] === 'undefined') {
      part[arr[i]] = {};
    }
    part = part[arr[i]];
  }

  // build the function and attach it to the client
  part[arr.pop()] = function() {
    let args = Array.from(arguments);
    return new Promise(function(resolve) {
      if (typeof args[args.length - 1] === "function") {  // if the function has a callback argument
        let callback = args.pop();
        chrome.runtime.sendMessage({'method': dottedName, 'args': args}, (resp) => {
          resolve(callback(resp));
        });
      } else {
        chrome.runtime.sendMessage({'method': dottedName, 'args': args}, (resp) => {
          resolve(resp);
        });
      }
    });
  };
}

/**
 * Client for calling remote functions.
 */
function Client(methods) {
  if (!methods) {
    methods = defaultMethods;
  }
  // build the RPC functions
  for (let dottedName of methods) {
    _makeMethodCaller(this, dottedName);
  }
}

return {Listener, Client};
})();
