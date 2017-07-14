require.scopes.messages = (() => {

let methods = new Set([
  'badger.isPrivacyBadgerEnabled',
  'badger.getAllOriginsForTab',
  'badger.enablePrivacyBadgerForOrigin',
  'badger.disablePrivacyBadgerForOrigin',
  'badger.refreshIconAndContextMenu',
  'badger.storage.revertUserAction',
  'badger.storage.getBestAction',
]);

function Listener() {
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

function _makeMethodCaller(client, dottedName) {
  let arr = dottedName.split('.'),
    part = client;
  arr.shift();
  for (let i = 0; i < arr.length - 1; i++) {
    part = part[arr[i]];
  }

  part[arr.pop()] = function() {
    let args = Array.from(arguments);
    return new Promise(function(resolve) {
      if (typeof args[args.length - 1] === "function") {
        let callback = args.pop();
        chrome.runtime.sendMessage({'method': dottedName, 'args': args}, (resp) => {resolve(callback(resp));}
        );
      } else {
        chrome.runtime.sendMessage({'method': dottedName, 'args': args}, (resp) => {resolve(resp)});
      }
    });
  };
}

function Client() {
  this.storage = {};
  for (let dottedName of methods) {
    _makeMethodCaller(this, dottedName);
  }
  console.log(this);
}

let exports = {
  Listener: Listener,
  Client: Client,
};

return exports;
})();
