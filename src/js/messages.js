require.scopes.messages = (() => {

let methods = new Set([
  'isPrivacyBadgerEnabled',
]);

function Listener(badger) {
  this.badger = badger;
  this.methods = methods;
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
    chrome.runtime.sendMessage({'method': method, 'args': args}, callback);
  };

  this.isPrivacyBadgerEnabled = function(origin, callback) {
    sendMessage('isPrivacyBadgerEnabled', [origin], callback);
  };
}

let exports = {
  Listener: Listener,
  Client: Client,
};

return exports;
})();
