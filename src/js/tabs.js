/* we need to know the host associated with a give tabid in a synchronous way,
 * so lets start with host bookeeping.
 *
 * maybe we could also do this by just tracking responses from webrequests.
 * this doesn't catch window.onpopstate like in this SO question. this is what
 * https://stackoverflow.com/questions/824349/modify-the-url-without-reloading-the-page
 * this is what twitter does
 *
 */
/* globals log:false */
require.scopes.tabs = (function() {


let ready = false;
let tabs = {};

function newFrameData(tabURL, frameURL) {
  return {'tabURL': tabURL, 'frameURL': frameURL};
}


/* must run before requestAccountant is listening */
function initialize() {
  log('initializing existing tabs');
  chrome.tabs.query({}, (tabArray) => {
    tabArray.forEach((tab) => {
      tabs[tab.id] = {0: newFrameData(tab.url, tab.url)};
      log('initializing tab: ' + tab.id + '\nwith url: ' + tab.url);
    });
    ready = true;
    log('done initializing tabs');
  });
}

function onTabCreated(tab) {
  let frames = tabs[tab.id];
  if (!frames) {
    tabs[tab.id] = {0: newFrameData(tab.url, tab.url)};
  }
}

function onTabUpdated(tabId, changeInfo, tab) {
  if (!changeInfo.url) {
    return;
  }
  if (tabs[tabId] && tabs[tabId][0]) {
    if (tabs[tabId][0].tabURL == changeInfo.url) {
      log('onTabUpdated: this tab has the correct url already');
    } else {
      tabs[tabId][0] = newFrameData(changeInfo.url, changeInfo.url);
    }
  }
}

function isMainPage(details) {
  if (details.frameId == 0 &&
      details.method == 'GET' &&
      details.type == 'main_frame') {
    return true;
  }
  return false;
}

function isSubFrame(details) {
  if (details.frameId > 0 &&
      (details.type == 'main_frame' || details.type == 'sub_frame')) {
    return true;
  }
  return false;
}


/**
 * Receives the details object that is passed from webRequest.onBeforeRequest
 */
function requestAccountant(details) {
  console.log(details);
  if (isMainPage(details)) {
    log('New tab url: ' + details.url);
    tabs[details.tabId] = {0: details.url};
  } else if (isSubFrame(details)) {
    let frames = tabs[details.tabId];
    if (!frames) {
      log('ERROR unitialized tab for :' + details.tabId);
    }
    frames[details.frameId] = details.url;
  }
}

function getFrameHostname(tabId, frameId) {
  return window.extractHostFromURL(tabs[tabId][frameId].frameURL);
}

/**
 * Gets the host name for a given tab id
 * @param {Integer} tabId chrome tab id
 * @return {String} the host name for the tab
 */
function getTabHostname(tabId) {
  return getFrameHostname(tabId, 0);
}


let exports = {};
exports.requestAccountant = requestAccountant;
exports.getTabHostname = getTabHostname;
exports.getFrameHostname = getFrameHostname;
return exports;
})();
