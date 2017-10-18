/*
 *
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2016 Electronic Frontier Foundation
 *
 * Derived from Adblock Plus
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Derived from Chameleon <https://github.com/ghostwords/chameleon>
 * Copyright (C) 2015 ghostwords
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

/* globals badger:false, log:false */

var constants = require('constants');
var getSurrogateURI = require('surrogates').getSurrogateURI;
var mdfp = require('multiDomainFP');
var incognito = require("incognito");

require.scopes.webrequest = (function() {

/*********************** webrequest scope **/


/************ Local Variables *****************/
var temporarySocialWidgetUnblock = {};

/***************** Blocking Listener Functions **************/

/**
 * Event handling of http requests, main logic to collect data what to block
 *
 * @param details The event details
 * @returns {*} Can cancel requests
 */
function onBeforeRequest(details) {
  var frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url;

  if (type == "main_frame") {
    forgetTab(tab_id);
  }

  if (type == "main_frame" || type == "sub_frame") {
    // Firefox workaround: https://bugzilla.mozilla.org/show_bug.cgi?id=1329299
    // TODO remove after Firefox 51 is no longer in use
    if (type == "main_frame" && frame_id != 0) {
      frame_id = 0;
    }
    badger.recordFrame(tab_id, frame_id, details.parentFrameId, url);
  }

  // Block ping requests sent by navigator.sendBeacon (see, #587)
  // tabId for pings are always -1 due to Chrome bugs #522124 and #522129
  // Once these bugs are fixed, PB will treat pings as any other request
  if (type == "ping" && tab_id < 0) {
    return {cancel: true};
  }

  if (_isTabChromeInternal(tab_id)) {
    return {};
  }

  var tabDomain = getHostForTab(tab_id);
  var requestDomain = window.extractHostFromURL(url);

  if (badger.isPrivacyBadgerDisabled(tabDomain)) {
    return {};
  }

  if (!isThirdPartyDomain(requestDomain, tabDomain)) {
    return {};
  }

  var requestAction = checkAction(tab_id, url, false, frame_id);
  if (requestAction) {
    if (requestAction == constants.BLOCK || requestAction == constants.USER_BLOCK) {
      if (type == 'script') {
        var surrogate = getSurrogateURI(url, requestDomain);
        if (surrogate) {
          return {redirectUrl: surrogate};
        }
      }

      // Notify the content script...
      var msg = {
        replaceSocialWidget: true,
        trackerDomain: requestDomain
      };
      chrome.tabs.sendMessage(tab_id, msg);

      window.setTimeout(function () {
        badger.checkForDNTPolicy(requestDomain);
      }, 10);

      return {cancel: true};
    }
  }

}

/**
 * Filters outgoing cookies and referer
 * Injects DNT
 *
 * @param details Event details
 * @returns {*} modified headers
 */
function onBeforeSendHeaders(details) {
  let frame_id = details.frameId,
    headers = details.requestHeaders,
    tab_id = details.tabId,
    type = details.type,
    url = details.url;

  if (_isTabChromeInternal(tab_id)) {
    // DNT policy requests: strip cookies
    if (type == "xmlhttprequest" && url.endsWith("/.well-known/dnt-policy.txt")) {
      // remove Cookie headers
      let newHeaders = [];
      for (let i = 0, count = headers.length; i < count; i++) {
        if (headers[i].name.toLowerCase() != "cookie") {
          newHeaders.push(headers[i]);
        }
      }
      return {
        requestHeaders: newHeaders
      };
    }

    return {};
  }

  var tabDomain = getHostForTab(tab_id);
  var requestDomain = window.extractHostFromURL(url);

  if (badger.isPrivacyBadgerEnabled(tabDomain) &&
      isThirdPartyDomain(requestDomain, tabDomain)) {
    var requestAction = checkAction(tab_id, url, false, frame_id);
    // If this might be the third strike against the potential tracker which
    // would cause it to be blocked we should check immediately if it will be blocked.
    if (requestAction == constants.ALLOW &&
        badger.storage.getTrackingCount(requestDomain) == constants.TRACKING_THRESHOLD - 1) {
      badger.heuristicBlocking.heuristicBlockingAccounting(details);
      requestAction = checkAction(tab_id, url, false, frame_id);
    }

    // This will only happen if the above code sets the action for the request
    // to block
    if (requestAction == constants.BLOCK) {
      if (type == 'script') {
        var surrogate = getSurrogateURI(url, requestDomain);
        if (surrogate) {
          return {redirectUrl: surrogate};
        }
      }

      // Notify the content script...
      var msg = {
        replaceSocialWidget: true,
        trackerDomain: requestDomain
      };
      chrome.tabs.sendMessage(tab_id, msg);

      window.setTimeout(function () {
        badger.checkForDNTPolicy(requestDomain);
      }, 10);

      return {cancel: true};
    }

    // This is the typical codepath
    if (requestAction == constants.COOKIEBLOCK || requestAction == constants.USER_COOKIE_BLOCK) {
      var newHeaders = headers.filter(function(header) {
        return (header.name.toLowerCase() != "cookie" && header.name.toLowerCase() != "referer");
      });
      newHeaders.push({name: "DNT", value: "1"});
      return {requestHeaders: newHeaders};
    }
  }

  // Still sending Do Not Track even if HTTP and cookie blocking are disabled
  headers.push({name: "DNT", value: "1"});
  return {requestHeaders: headers};
}

/**
 * Filters incoming cookies out of the response header
 *
 * @param details The event details
 * @returns {*} The new response header
 */
function onHeadersReceived(details) {
  var tab_id = details.tabId,
    url = details.url;

  if (_isTabChromeInternal(tab_id)) {
    // DNT policy responses: strip cookies, reject redirects
    if (details.type == "xmlhttprequest" && url.endsWith("/.well-known/dnt-policy.txt")) {
      // if it's a redirect, cancel it
      if (details.statusCode >= 300 && details.statusCode < 400) {
        return {
          cancel: true
        };
      }

      // remove Set-Cookie headers
      let headers = details.responseHeaders,
        newHeaders = [];
      for (let i = 0, count = headers.length; i < count; i++) {
        if (headers[i].name.toLowerCase() != "set-cookie") {
          newHeaders.push(headers[i]);
        }
      }
      return {
        responseHeaders: newHeaders
      };
    }

    return {};
  }

  var tabDomain = getHostForTab(tab_id);
  var requestDomain = window.extractHostFromURL(url);

  if (badger.isPrivacyBadgerDisabled(tabDomain)) {
    return {};
  }

  if (!isThirdPartyDomain(requestDomain, tabDomain)) {
    return {};
  }

  var requestAction = checkAction(tab_id, url, false, details.frameId);
  if (requestAction) {
    if (requestAction == constants.COOKIEBLOCK || requestAction == constants.USER_COOKIE_BLOCK) {
      var newHeaders = details.responseHeaders.filter(function(header) {
        return (header.name.toLowerCase() != "set-cookie");
      });
      return {responseHeaders: newHeaders};
    }
  }
}

/*************** Non-blocking listener functions ***************/

/**
 * Event handler when a tab gets removed
 *
 * @param {Integer} tabId Id of the tab
 */
function onTabRemoved(tabId) {
  forgetTab(tabId);
}

/**
 * Update internal db on tabs when a tab gets replaced
 *
 * @param {Integer} addedTabId The new tab id that replaces
 * @param {Integer} removedTabId The tab id that gets removed
 */
function onTabReplaced(addedTabId, removedTabId) {
  forgetTab(removedTabId);
  // Update the badge of the added tab, which was probably used for prerendering.
  badger.updateBadge(addedTabId);
}

/******** Utility Functions **********/

/**
 * check if a domain is third party
 * @param {String} domain1 an fqdn
 * @param {String} domain2 a second fqdn
 *
 * @return boolean true if the domains are third party
 */
function isThirdPartyDomain(domain1, domain2) {
  var base1 = window.getBaseDomain(domain1);
  var base2 = window.getBaseDomain(domain2);

  if (window.isThirdParty(base1, base2)) {
    return !mdfp.isMultiDomainFirstParty(base1, base2);
  }
  return false;
}

/**
 * Gets the host name for a given tab id
 * @param {Integer} tabId chrome tab id
 * @return {String} the host name for the tab
 */
function getHostForTab(tabId) {
  var mainFrameIdx = 0;
  if (!badger.tabData[tabId]) {
    return '';
  }
  // TODO what does this actually do?
  // meant to address https://github.com/EFForg/privacybadger/issues/136
  if (_isTabAnExtension(tabId)) {
    // If the tab is an extension get the url of the first frame for its implied URL
    // since the url of frame 0 will be the hash of the extension key
    mainFrameIdx = Object.keys(badger.tabData[tabId].frames)[1] || 0;
  }
  if (!badger.tabData[tabId].frames[mainFrameIdx]) {
    return '';
  }
  return window.extractHostFromURL(badger.tabData[tabId].frames[mainFrameIdx].url);
}

/**
 * Record "supercookie" tracking
 *
 * @param sender message sender
 * @param msg super cookie message dict
 */
function recordSuperCookie(sender, msg) {
  if (incognito.tabIsIncognito(sender.tab.id)) {
    return;
  }

  // docUrl: url of the frame with supercookie
  var frameHost = window.extractHostFromURL(msg.docUrl);
  var pageHost = window.extractHostFromURL(getFrameUrl(sender.tab.id, 0));

  if (!isThirdPartyDomain(frameHost, pageHost)) {
    // Only happens on the start page for google.com
    return;
  }

  badger.heuristicBlocking.updateTrackerPrevalence(
    frameHost, window.getBaseDomain(pageHost));
}

/**
 * Record canvas fingerprinting
 *
 * @param {Integer} tabId
 * @param msg specific fingerprinting data
 */
function recordFingerprinting(tabId, msg) {
  // Abort if we failed to determine the originating script's URL
  // TODO find and fix where this happens
  if (!msg.scriptUrl) {
    return;
  }
  if (incognito.tabIsIncognito(tabId)) {
    return;
  }

  // Ignore first-party scripts
  var script_host = window.extractHostFromURL(msg.scriptUrl),
    document_host = window.extractHostFromURL(getFrameUrl(tabId, 0));
  if (!isThirdPartyDomain(script_host, document_host)) {
    return;
  }

  var CANVAS_WRITE = {
    fillText: true,
    strokeText: true
  };
  var CANVAS_READ = {
    getImageData: true,
    toDataURL: true
  };

  if (!badger.tabData[tabId].hasOwnProperty('fpData')) {
    badger.tabData[tabId].fpData = {};
  }

  var script_origin = window.getBaseDomain(script_host);

  // Initialize script TLD-level data
  if (!badger.tabData[tabId].fpData.hasOwnProperty(script_origin)) {
    badger.tabData[tabId].fpData[script_origin] = {
      canvas: {
        fingerprinting: false,
        write: false
      }
    };
  }
  var scriptData = badger.tabData[tabId].fpData[script_origin];

  if (msg.extra.hasOwnProperty('canvas')) {
    if (scriptData.canvas.fingerprinting) {
      return;
    }

    // If this script already had a canvas write...
    if (scriptData.canvas.write) {
      // ...and if this is a canvas read...
      if (CANVAS_READ.hasOwnProperty(msg.prop)) {
        // ...and it got enough data...
        if (msg.extra.width > 16 && msg.extra.height > 16) {
          // ...we will classify it as fingerprinting
          scriptData.canvas.fingerprinting = true;
          log(script_host, 'caught fingerprinting on', document_host);

          // Mark this as a strike
          badger.heuristicBlocking.updateTrackerPrevalence(
            script_host, window.getBaseDomain(document_host));
        }
      }
      // This is a canvas write
    } else if (CANVAS_WRITE.hasOwnProperty(msg.prop)) {
      scriptData.canvas.write = true;
    }
  }
}


/**
 * Read the frame data from memory
 *
 * @param tab_id Tab ID to check for
 * @param frame_id Frame ID to check for
 * @returns {*} Frame data object or null
 */
function getFrameData(tab_id, frame_id) {
  if (badger.tabData.hasOwnProperty(tab_id)) {
    if (badger.tabData[tab_id].frames.hasOwnProperty(frame_id)) {
      return badger.tabData[tab_id].frames[frame_id];
    }
  }
  return null;
}

/**
 * Based on tab/frame ids, get the URL
 *
 * @param {Integer} tabId The tab id to look up
 * @param {Integer} frameId The frame id to look up
 * @returns {String} The url
 */
function getFrameUrl(tabId, frameId) {
  var frameData = getFrameData(tabId, frameId);
  return (frameData ? frameData.url : null);
}

/**
 * Delete tab data, de-register tab
 *
 * @param {Integer} tabId The id of the tab
 */
function forgetTab(tabId) {
  delete badger.tabData[tabId];
  delete temporarySocialWidgetUnblock[tabId];
}

/**
 * Determines the action to take on a specific URL.
 *
 * @param {Integer} tabId The relevant tab
 * @param {String} url The URL
 * @param {Boolean} quiet Do not update internal data
 * @param {Integer} frameId The id of the frame
 * @returns {boolean} false or the action to take
 */
function checkAction(tabId, url, quiet, frameId) {
  // Ignore requests from temporarily unblocked social widgets.
  // Someone clicked the widget, so let it load.
  if (isSocialWidgetTemporaryUnblock(tabId, url, frameId)) {
    return false;
  }

  // Ignore requests from internal Chrome tabs.
  if (_isTabChromeInternal(tabId)) {
    return false;
  }

  // Ignore requests that don't have a document URL for some reason.
  var documentUrl = getFrameUrl(tabId, 0);
  if (! documentUrl) {
    return false;
  }

  // Ignore requests from private domains.
  var requestHost = window.extractHostFromURL(url);
  var origin = window.getBaseDomain(requestHost);
  if (window.isPrivateDomain(origin)) {
    return false;
  }

  // Ignore requests that aren't from a third party.
  var documentHost = window.extractHostFromURL(documentUrl);
  var thirdParty = isThirdPartyDomain(requestHost, documentHost);
  if (! thirdParty) {
    return false;
  }

  // Determine action is request is from third party and tab is valid.
  var action = badger.storage.getBestAction(requestHost);

  if (action && ! quiet) {
    badger.logThirdPartyOriginOnTab(tabId, requestHost, action);
  }
  return action;
}

/**
 * Check if the url of the tab starts with the given string
 *
 * @param {Integer} tabId Id of the tab
 * @param {String} str String to check against
 * @returns {boolean} true if starts with string
 * @private
 */
function _frameUrlStartsWith(tabId, str) {
  let frameData = getFrameData(tabId, 0);
  return frameData && frameData.url.indexOf(str) === 0;
}

/**
 * Checks if the tab is chrome internal
 *
 * @param {Integer} tabId Id of the tab to test
 * @returns {boolean} Returns true if the tab is chrome internal
 * @private
 */
function _isTabChromeInternal(tabId) {
  return tabId < 0 || !_frameUrlStartsWith(tabId, "http");
}

/**
 * Checks if the tab is a chrome-extension tab
 *
 * @param {Integer} tabId Id of the tab to test
 * @returns {boolean} Returns true if the tab is from a chrome-extension
 * @private
 */
function _isTabAnExtension(tabId) {
  return (
    _frameUrlStartsWith(tabId, "chrome-extension://") ||
    _frameUrlStartsWith(tabId, "moz-extension://")
  );
}

/**
 * Provides the social widget blocking content script with list of social widgets to block
 *
 * @returns a specific dict
 */
function getSocialWidgetBlockList() {

  // A mapping of individual SocialWidget objects to boolean values that determine
  // whether the content script should replace that tracker's social buttons
  var socialWidgetsToReplace = {};

  window.SocialWidgetList.forEach(function(socialwidget) {
    var socialWidgetName = socialwidget.name;

    // Only replace social widgets that the user has not manually allowed
    socialWidgetsToReplace[socialWidgetName] = !(badger.userAllow.indexOf(socialwidget.domain) > -1);
  });

  return {
    "trackers" : window.SocialWidgetList,
    "trackerButtonsToReplace" : socialWidgetsToReplace
  };
}

/**
 * Check if tab is temporarily unblocked for tracker
 *
 * @param tabId id of the tab to check
 * @param url url to check
 * @param frameId frame id to check
 * @returns {boolean} true if in exception list
 */
function isSocialWidgetTemporaryUnblock(tabId, url, frameId) {
  var exceptions = temporarySocialWidgetUnblock[tabId];
  if (exceptions === undefined) {
    return false;
  }

  var requestHost = window.extractHostFromURL(url);
  var requestExcept = (exceptions.indexOf(requestHost) != -1);

  var frameHost = window.extractHostFromURL(getFrameUrl(tabId, frameId));
  var frameExcept = (exceptions.indexOf(frameHost) != -1);

  return (requestExcept || frameExcept);
}

/**
 * Unblocks a tracker just temporarily on this tab, because the user has clicked the
 * corresponding replacement social widget.
 *
 * @param {Integer} tabId The id of the tab
 * @param {Array} socialWidgetUrls an array of social widget urls
 */
function unblockSocialWidgetOnTab(tabId, socialWidgetUrls) {
  if (temporarySocialWidgetUnblock[tabId] === undefined) {
    temporarySocialWidgetUnblock[tabId] = [];
  }
  for (var i in socialWidgetUrls) {
    var socialWidgetUrl = socialWidgetUrls[i];
    var socialWidgetHost = window.extractHostFromURL(socialWidgetUrl);
    temporarySocialWidgetUnblock[tabId].push(socialWidgetHost);
  }
}

function dispatcher(request, sender, sendResponse) {
  var tabHost;
  if (sender.tab && sender.tab.url) {
    tabHost = window.extractHostFromURL(sender.tab.url);
  } else {
    log("tabhost is  blank!!");
  }

  if (request.checkEnabled) {
    sendResponse(badger.isPrivacyBadgerEnabled(tabHost));

  } else if (request.checkLocation) {
    if (badger.isPrivacyBadgerEnabled(tabHost)) {
      var documentHost = request.checkLocation;
      var reqAction = checkAction(sender.tab.id, documentHost, true);
      var cookieBlock = reqAction == constants.COOKIEBLOCK || reqAction == constants.USER_COOKIE_BLOCK;
      sendResponse(cookieBlock);
    }

  } else if (request.checkReplaceButton) {
    if (badger.isPrivacyBadgerEnabled(tabHost) && badger.isSocialWidgetReplacementEnabled()) {
      var socialWidgetBlockList = getSocialWidgetBlockList();
      sendResponse(socialWidgetBlockList);
    }
  } else if (request.unblockSocialWidget) {
    var socialWidgetUrls = request.buttonUrls;
    unblockSocialWidgetOnTab(sender.tab.id, socialWidgetUrls);
    sendResponse();

  // Canvas fingerprinting
  } else if (request.fpReport) {
    if (!badger.isPrivacyBadgerEnabled(tabHost)) { return; }
    if (Array.isArray(request.fpReport)) {
      request.fpReport.forEach(function (msg) {
        recordFingerprinting(sender.tab.id, msg);
      });
    } else {
      recordFingerprinting(sender.tab.id, request.fpReport);
    }

  } else if (request.superCookieReport) {
    if (badger.hasSuperCookie(request.superCookieReport)) {
      recordSuperCookie(sender, request.superCookieReport);
    }
  } else if (request.checkEnabledAndThirdParty) {
    var pageHost = window.extractHostFromURL(sender.url);
    sendResponse(badger.isPrivacyBadgerEnabled(tabHost) && isThirdPartyDomain(pageHost, tabHost));
  } else if (request.checkSocialWidgetReplacementEnabled) {
    sendResponse(badger.isPrivacyBadgerEnabled(tabHost) && badger.isSocialWidgetReplacementEnabled());
  }
}

/*************** Event Listeners *********************/
function startListeners() {
  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
  chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*", "https://*/*"]}, ["requestHeaders", "blocking"]);
  chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["<all_urls>"]}, ["responseHeaders", "blocking"]);
  chrome.tabs.onRemoved.addListener(onTabRemoved);
  chrome.tabs.onReplaced.addListener(onTabReplaced);
  chrome.runtime.onMessage.addListener(dispatcher);
}

/************************************** exports */
var exports = {};
exports.getHostForTab = getHostForTab;
exports.startListeners = startListeners;
return exports;
/************************************** exports */
})();
