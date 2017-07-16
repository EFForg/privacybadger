chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabs) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("skin/popup.html") + "?id=" + tabs[0].id
    });
  });
});
