var firstPartyScripts = {
  "twitter.com": "twitter.js"
};

function insert() {
  let scriptName = firstPartyScripts[window.location.hostname];
  if (!scriptName) {
    return;
  }
  let script = document.createElement('script');
  script.src = chrome.extension.getURL('js/first_parties/' + scriptName);
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}
insert();
