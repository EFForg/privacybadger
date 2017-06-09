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

// receives the details object that is passed from webRequest.onBeforeRequest 
function requestAccountant(details) {
  if (isMainPage(details)) {
    log('New tab url: ' + details.url);
    tabs[details.tabId] = details.url;
  }
  console.log(details);
}


/**
 * Gets the host name for a given tab id
 * @param {Integer} tabId chrome tab id
 * @return {String} the host name for the tab
 */
function getTabHost(details) {
  let url = tabs[details.tabId];
  if (!url) {
    log('ERROR: missing url');
    return '';
  }
  return window.extractHostFromURL(url);
}


let exports = {};
exports.requestAccountant = requestAccountant;
exports.getTabHost = getTabHost;
return exports;
})();
