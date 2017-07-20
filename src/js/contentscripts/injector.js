let event_id = Math.random();

// listen for messages from the script we are about to insert
document.addEventListener(event_id, function (e) {
  chrome.runtime.sendMessage({'fpReport': e.detail});
});

function addScript(path) {
  let s = document.createElement('script');
  s.setAttribute('data', event_id);
  s.src = chrome.extension.getURL(path);
  s.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(s);
}

addScript('js/injected/fingerprinting.js');
