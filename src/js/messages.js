require.scopes.messages = (() => {

let methods = new Set([
  'isPrivacyBadgerEnabled',
  'getAllOriginsForTab',
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

function Client() {
  function sendMessage(method, args, callback) {
    console.log(arguments);
    chrome.runtime.sendMessage({'method': method, 'args': args}, callback);
  };

  this.isPrivacyBadgerEnabled = function(origin, callback) {
    sendMessage('isPrivacyBadgerEnabled', [origin], callback);
  };
  this.getAllOriginsForTab = function(tabId, callback) {
    sendMessage('getAllOriginsForTab', [tabId], callback);
  };
}

let exports = {
  Listener: Listener,
  Client: Client,
};

return exports;
})();
