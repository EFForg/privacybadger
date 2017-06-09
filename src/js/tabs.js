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

let tabs = {};

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

function getFrameHost(tabId, frameId) {
  let frames = tabs[tabId];
  if (!frames) {
    log('ERROR: missing tab data for tabId: ' + tabId);
    return '';
  }
  let url = frames[frameId];
  if (!url) {
    log('ERROR: missing subframe url for: ' + url);
  }
  return window.extractHostFromURL(frames[frameId]);
}


/**
 * Gets the host name for a given tab id
 * @param {Integer} tabId chrome tab id
 * @return {String} the host name for the tab
 */
function getTabHost(tabId) {
  return getFrameHost(tabId, 0);
}


let exports = {};
exports.requestAccountant = requestAccountant;
exports.getTabHost = getTabHost;
return exports;
})();
