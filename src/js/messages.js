require.scopes.messages = (() => {

let methods = new Set([
  'isPrivacyBadgerEnabled',
  'getAllOriginsForTab',
  'enablePrivacyBadgerForOrigin',
  'disablePrivacyBadgerForOrigin',
  'refreshIconAndContextMenu',
]);

function Listener(badger) {
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (methods.has(request.method)) {
        sendResponse(badger[request.method].apply(badger, request.args));
      }
    }
  );
}

function _makeMethodCaller(name) {
  return function() {
    let args = Array.from(arguments);
    console.log(args);
    if (typeof args[args.length - 1] === "function") {
      let callback = args.pop();
      chrome.runtime.sendMessage({'method': name, 'args': args}, callback);
    } else {
      chrome.runtime.sendMessage({'method': name, 'args': args});
    }
  };
}

function Client() {
  for (let name of methods) {
    this[name] = _makeMethodCaller(name);
  }
  console.log(this);
}

let exports = {
  Listener: Listener,
  Client: Client,
};

return exports;
})();
