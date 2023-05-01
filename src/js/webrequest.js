/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

/* globals badger:false */

import { extractHostFromURL, getBaseDomain, isPrivateDomain } from "../lib/basedomain.js";

import { log } from "./bootstrap.js";
import constants from "./constants.js";
import incognito from "./incognito.js";
import surrogates from "./surrogates.js";
import utils from "./utils.js";

/************ Local Variables *****************/

let tempAllowlist = {},
  tempAllowedWidgets = {};

/***************** Blocking Listener Functions **************/

/**
 * Event handling of http requests, main logic to collect data what to block
 *
 * @param {Object} details The event details
 * @returns {Object} Can cancel requests
 */
function onBeforeRequest(details) {
  if (!badger.INITIALIZED) {
    return;
  }

  let frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url,
    sw_request = false;

  if (type == "main_frame") {
    let oldTabData = badger.tabData.getFrameData(tab_id),
      is_reload = oldTabData && oldTabData.url == url;
    forgetTab(tab_id, is_reload);
    badger.tabData.recordFrame(tab_id, frame_id, url);
    initAllowedWidgets(tab_id, badger.tabData.getFrameData(tab_id).host);
    return;
  }

  // Block ping requests sent by navigator.sendBeacon (see, #587)
  // tabId for pings are always -1 due to Chrome bugs #522124 and #522129
  // Once these bugs are fixed, PB will treat pings as any other request
  if (type == "ping" && tab_id < 0) {
    return {cancel: true};
  }

  if (tab_id < 0) {
    // TODO may also want to apply this workaround in onBeforeSendHeaders(),
    // TODO onHeadersReceived() and heuristicBlockingAccounting()
    tab_id = guessTabIdFromInitiator(details);
    if (tab_id < 0) {
      // TODO we still miss SW requests that show up after on-tab close cleanup
      //
      // TODO could also miss SW requests that come before webNavigation fires
      //
      // TODO also, if there are multiple tabs with the same URL,
      // TODO we might assign SW requests to the wrong tab,
      // TODO or miss them entirely (when the more recently opened tab
      // TODO gets closed while the older tab is still loading)
      return;
    } else {
      // NOTE details.type is always xmlhttprequest for SW-initiated requests in Chrome,
      // which means surrogation won't work and frames won't get collapsed.
      // As a workaround, let's perform surrogation checks for all SW requests,
      // although we may redirect a non-script resource request to a matching surrogate.
      sw_request = true;
    }
  }

  let request_host = extractHostFromURL(url);

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, request_host)) {
    request_host = badger.cnameDomains[request_host];
  }

  let frameData = badger.tabData.getFrameData(tab_id);
  if (!frameData) {
    return;
  }

  if (type == "sub_frame") {
    badger.tabData.recordFrame(tab_id, frame_id, url);
  }

  let tab_host = frameData.host;

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    return;
  }

  let action = checkAction(tab_id, request_host, frame_id);
  if (!action) {
    return;
  }

  badger.logThirdPartyOriginOnTab(tab_id, request_host, action);

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return;
  }

  // block requests to known fingerprinter scripts
  // hosted by (user)cookieblocked CDNs
  if (type == 'script' || sw_request) {
    if (action == constants.COOKIEBLOCK || action == constants.USER_COOKIEBLOCK) {
      if (request_host == 'cdn.jsdelivr.net' ||
        request_host == 'cdnjs.cloudflare.com' ||
        request_host == 'd1af033869koo7.cloudfront.net' ||
        request_host == 'd38xvr37kwwhcm.cloudfront.net' ||
        request_host == 'd.alicdn.com' ||
        request_host == 'fp-cdn.azureedge.net' ||
        request_host == 'sdtagging.azureedge.net' ||
        request_host == 'gadasource.storage.googleapis.com') {

        let fpScripts = badger.storage.getStore('fp_scripts').getItem(request_host);

        if (fpScripts) {
          let script_path = url.slice(url.indexOf(request_host) + request_host.length),
            qs_start = script_path.indexOf('?');
          if (qs_start != -1) {
            script_path = script_path.slice(0, qs_start);
          }
          if (utils.hasOwn(fpScripts, script_path)) {
            badger.tabData.logFpScript(tab_id, request_host, url);

            let surrogate = surrogates.getSurrogateUri(url, request_host);
            if (surrogate) {
              let secret = getWarSecret(tab_id, frame_id, surrogate);
              return {
                redirectUrl: surrogate + '?key=' + secret
              };
            }

            return { cancel: true };
          }
        }
      }
    }
  }

  if (action != constants.BLOCK && action != constants.USER_BLOCK) {
    return;
  }

  if (type == 'script' || sw_request) {
    let surrogate;

    if (utils.hasOwn(surrogates.WIDGET_SURROGATES, request_host)) {
      let settings = badger.getSettings();
      if (settings.getItem("socialWidgetReplacementEnabled") && !settings.getItem('widgetReplacementExceptions').includes(surrogates.WIDGET_SURROGATES[request_host].widgetName)) {
        surrogate = surrogates.getSurrogateUri(url, request_host);
      }

    } else {
      surrogate = surrogates.getSurrogateUri(url, request_host);
    }

    if (surrogate) {
      let secret = getWarSecret(tab_id, frame_id, surrogate);
      return {
        redirectUrl: surrogate + '?key=' + secret
      };
    }
  }

  // notify the widget replacement content script
  chrome.tabs.sendMessage(tab_id, {
    type: "replaceWidget",
    trackerDomain: request_host,
    frameId: (type == 'sub_frame' ? details.parentFrameId : frame_id)
  });

  // if this is a heuristically- (not user-) blocked domain
  if (action == constants.BLOCK && incognito.learningEnabled(tab_id)) {
    // check for DNT policy asynchronously
    setTimeout(function () {
      badger.checkForDNTPolicy(request_host);
    }, 0);
  }

  if (type == 'sub_frame') {
    setTimeout(function () {
      hideBlockedFrame(tab_id, details.parentFrameId, url, request_host);
    }, 0);
  }

  return {cancel: true};
}

/**
 * Generates a token for a given tab ID/frame ID/resource URL combination.
 *
 * @param {Integer} tab_id
 * @param {Integer} frame_id
 * @param {String} url
 *
 * @returns {String}
 */
function getWarSecret(tab_id, frame_id, url) {
  let secret = (+(("" + Math.random()).slice(2))).toString(16),
    frameData = badger.tabData.getFrameData(tab_id, frame_id);

  if (!frameData) {
    badger.tabData.recordFrame(tab_id, frame_id, null);
    frameData = badger.tabData.getFrameData(tab_id, frame_id);
  }

  let tokens = frameData.warAccessTokens;

  if (!tokens) {
    tokens = {};
    frameData.warAccessTokens = tokens;
  }

  tokens[url] = secret;

  return secret;
}

/**
 * Guards against web_accessible_resources abuse.
 *
 * Checks whether there is a previously saved token
 * for a given tab ID/frame ID/resource URL combination,
 * and whether the full request URL contains this token.
 *
 * @param {Object} details webRequest request details object
 *
 * @returns {Object|undefined} Can cancel requests
 */
function filterWarRequests(details) {
  if (!badger.INITIALIZED) {
    return;
  }

  let url = details.url,
    frameData = badger.tabData.getFrameData(details.tabId, details.frameId),
    tokens = frameData && frameData.warAccessTokens;

  if (!tokens) {
    return { cancel: true };
  }

  let qs_start = url.indexOf('?'),
    url_no_qs = qs_start && url.slice(0, qs_start),
    secret = url_no_qs && tokens[url_no_qs];

  if (!secret || url != `${url_no_qs}?key=${secret}`) {
    return { cancel: true };
  }

  delete tokens[url_no_qs];
}

/**
 * Blocks moz-extension CSP reports to mitigate
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1267027
 *
 * @param {Object} details webRequest request details object
 *
 * @returns {Object|undefined} Can cancel requests
 */
function blockMozCspReports(details) {
  let report;
  try {
    report = JSON.parse(
      String.fromCharCode.apply(null,
        new Uint8Array(details.requestBody.raw[0].bytes)));
  } catch (e) {
    console.error("Failed to parse CSP report:", e);
    return;
  }
  if (report['csp-report'] && report['csp-report']['source-file'] == 'moz-extension') {
    return { cancel: true };
  }
}

/**
 * Filters outgoing cookies and referer
 * Injects DNT
 *
 * @param {Object} details Event details
 * @returns {Object} modified headers
 */
function onBeforeSendHeaders(details) {
  if (!badger.INITIALIZED) {
    return;
  }

  let frame_id = details.frameId,
    tab_id = details.tabId,
    url = details.url,
    frameData = badger.tabData.getFrameData(tab_id);

  if (!frameData || tab_id < 0) {
    // strip cookies from DNT policy requests
    if (details.type == "xmlhttprequest" && url.endsWith("/.well-known/dnt-policy.txt")) {
      // remove Cookie headers
      let newHeaders = [];
      for (let i = 0, count = details.requestHeaders.length; i < count; i++) {
        let header = details.requestHeaders[i];
        if (header.name.toLowerCase() != "cookie") {
          newHeaders.push(header);
        }
      }
      return {
        requestHeaders: newHeaders
      };
    }

    // ignore otherwise
    return;
  }

  let tab_host = frameData.host;

  if (details.type == 'main_frame') {
    if (badger.isDntSignalEnabled(tab_host) && badger.isPrivacyBadgerEnabled(tab_host)) {
      details.requestHeaders.push({name: "DNT", value: "1"}, {name: "Sec-GPC", value: "1"});
      return { requestHeaders: details.requestHeaders };
    }

    return;
  }

  let request_host = extractHostFromURL(url);

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, request_host)) {
    request_host = badger.cnameDomains[request_host];
  }

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    if (badger.isDntSignalEnabled(tab_host) && badger.isPrivacyBadgerEnabled(tab_host)) {
      // send Do Not Track header even when HTTP and cookie blocking are disabled
      details.requestHeaders.push({name: "DNT", value: "1"}, {name: "Sec-GPC", value: "1"});
      return { requestHeaders: details.requestHeaders };
    }

    return;
  }

  let action = checkAction(tab_id, request_host, frame_id);

  if (action) {
    badger.logThirdPartyOriginOnTab(tab_id, request_host, action);
  }

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return;
  }

  // handle cookieblocked requests
  if (action == constants.COOKIEBLOCK || action == constants.USER_COOKIEBLOCK) {
    let newHeaders;

    // GET requests: remove cookie headers, reduce referrer header to origin
    if (details.method == "GET") {
      newHeaders = details.requestHeaders.filter(header => {
        return (header.name.toLowerCase() != "cookie");
      }).map(header => {
        if (header.name.toLowerCase() == "referer") {
          header.value = header.value.slice(
            0,
            header.value.indexOf('/', header.value.indexOf('://') + 3)
          ) + '/';
        }
        return header;
      });

    // remove cookie and referrer headers otherwise
    } else {
      newHeaders = details.requestHeaders.filter(header => {
        return (header.name.toLowerCase() != "cookie" && header.name.toLowerCase() != "referer");
      });
    }

    // add DNT header
    if (badger.isDntSignalEnabled(tab_host)) {
      newHeaders.push({name: "DNT", value: "1"}, {name: "Sec-GPC", value: "1"});
    }

    return {requestHeaders: newHeaders};
  }

  // if we are here, we're looking at a third-party request
  // that's not yet blocked or cookieblocked
  if (badger.isDntSignalEnabled(tab_host)) {
    details.requestHeaders.push({name: "DNT", value: "1"}, {name: "Sec-GPC", value: "1"});
  }
  return {requestHeaders: details.requestHeaders};
}

/**
 * Filters incoming cookies out of the response header
 *
 * @param {Object} details The event details
 * @returns {Object} The new response headers
 */
function onHeadersReceived(details) {
  if (!badger.INITIALIZED) {
    return;
  }

  // Google's Topics API: opt out all websites from topics generation
  if (details.type == 'main_frame') {
    if (badger.isTopicsOverwriteEnabled()) {
      let responseHeaders = details.responseHeaders || [];
      responseHeaders.push({
        name: 'permissions-policy',
        // https://github.com/GoogleChrome/developer.chrome.com/issues/2296#issuecomment-1075478309
        value: 'interest-cohort=()'
      });
      return { responseHeaders };
    }

    return;
  }

  let tab_id = details.tabId,
    url = details.url,
    frameData = badger.tabData.getFrameData(tab_id);

  if (!frameData || tab_id < 0 || utils.isRestrictedUrl(url)) {
    // strip cookies, reject redirects from DNT policy responses
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

    // ignore otherwise
    return;
  }

  let tab_host = frameData.host;
  let response_host = extractHostFromURL(url);

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, response_host)) {
    response_host = badger.cnameDomains[response_host];
  }

  if (!utils.isThirdPartyDomain(response_host, tab_host)) {
    return;
  }

  let action = checkAction(tab_id, response_host, details.frameId);
  if (!action) {
    return;
  }

  badger.logThirdPartyOriginOnTab(tab_id, response_host, action);

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return;
  }

  if (action == constants.COOKIEBLOCK || action == constants.USER_COOKIEBLOCK) {
    let newHeaders = details.responseHeaders.filter(function(header) {
      return (header.name.toLowerCase() != "set-cookie");
    });
    return {responseHeaders: newHeaders};
  }
}

/*************** Non-blocking listener functions ***************/

/**
 * Event handler when a tab gets removed
 *
 * @param {Integer} tabId Id of the tab
 */
function onTabRemoved(tabId) {
  if (badger.INITIALIZED) {
    forgetTab(tabId);
  }
}

/**
 * Update internal db on tabs when a tab gets replaced
 * due to prerendering or instant search.
 *
 * @param {Integer} addedTabId The new tab id that replaces
 * @param {Integer} removedTabId The tab id that gets removed
 */
function onTabReplaced(addedTabId, removedTabId) {
  if (!badger.INITIALIZED) {
    return;
  }
  forgetTab(removedTabId);
  // Update the badge of the added tab, which was probably used for prerendering.
  badger.updateBadge(addedTabId);
}

/**
 * We don't always get a "main_frame" details object in onBeforeRequest,
 * so we need a fallback for (re)initializing tabData.
 */
function onNavigate(details) {
  if (!badger.INITIALIZED) {
    return;
  }

  const tab_id = details.tabId,
    url = details.url;

  // main (top-level) frames only
  if (details.frameId !== 0) {
    return;
  }

  let oldTabData = badger.tabData.getFrameData(tab_id),
    is_reload = oldTabData && oldTabData.url == url;

  forgetTab(tab_id, is_reload);

  // forget but don't initialize on special browser/extension pages
  if (utils.isRestrictedUrl(url)) {
    return;
  }

  badger.tabData.recordFrame(tab_id, 0, url);

  let tab_host = badger.tabData.getFrameData(tab_id).host;

  initAllowedWidgets(tab_id, tab_host);

  // initialize tab data bookkeeping used by heuristicBlockingAccounting()
  // to avoid missing or misattributing learning
  // when there is no "main_frame" webRequest callback
  // (such as on Service Worker pages)
  //
  // see the tabOrigins TODO in heuristicblocking.js
  // as to why we don't just use tabData
  let base = getBaseDomain(tab_host);
  badger.heuristicBlocking.tabOrigins[tab_id] = base;
  badger.heuristicBlocking.tabUrls[tab_id] = url;
}

/******** Utility Functions **********/

/**
 * Messages collapser.js content script to hide blocked frames.
 */
function hideBlockedFrame(tab_id, parent_frame_id, frame_url, frame_host) {
  // don't hide if hiding is disabled
  if (!badger.getSettings().getItem('hideBlockedElements')) {
    return;
  }

  // don't hide widget frames
  if (badger.getSettings().getItem("socialWidgetReplacementEnabled")) {
    let exceptions = badger.getSettings().getItem('widgetReplacementExceptions');
    for (let widget of badger.widgetList) {
      if (exceptions.includes(widget.name)) {
        continue;
      }
      for (let domain of widget.domains) {
        if (domain == frame_host) {
          return;
        } else if (domain[0] == "*") { // leading wildcard domain
          if (frame_host.endsWith(domain.slice(1))) {
            return;
          }
        }
      }
    }
  }

  // message content script
  chrome.tabs.sendMessage(tab_id, {
    hideFrame: true,
    url: frame_url
  }, {
    frameId: parent_frame_id
  }, function (response) {
    if (response) {
      // content script was ready and received our message
      return;
    }
    // content script was not ready
    if (chrome.runtime.lastError) {
      // ignore
    }
    // record frame_url and parent_frame_id
    // for when content script becomes ready
    let tabData = badger.tabData._tabData[tab_id];
    if (!utils.hasOwn(tabData.blockedFrameUrls, parent_frame_id)) {
      tabData.blockedFrameUrls[parent_frame_id] = [];
    }
    tabData.blockedFrameUrls[parent_frame_id].push(frame_url);
  });
}

/**
 * Tries to work around tab ID of -1 for requests
 * originated by a Service Worker in Chrome.
 *
 * https://bugs.chromium.org/p/chromium/issues/detail?id=766433#c13
 *
 * @param {Object} details webRequest request/response details object
 *
 * @returns {Integer} the tab ID or -1
 */
function guessTabIdFromInitiator(details) {
  if (!details.initiator || details.initiator == "null") {
    return -1;
  }

  if (details.tabId != -1 || details.frameId != -1 || details.parentFrameId != -1 || details.type != "xmlhttprequest") {
    return -1;
  }

  // ignore trivially first party requests
  if (details.url.startsWith(details.initiator)) {
    return -1;
  }

  if (utils.hasOwn(badger.tabData.tabIdsByInitiator, details.initiator)) {
    return badger.tabData.tabIdsByInitiator[details.initiator];
  }

  return -1;
}

/**
 * Record "supercookie" tracking
 *
 * @param {Integer} tab_id browser tab ID
 * @param {String} frame_url URL of the frame with supercookie
 */
function recordSupercookie(tab_id, frame_url) {
  const frame_host = extractHostFromURL(frame_url),
    page_host = badger.tabData.getFrameData(tab_id).host;

  badger.heuristicBlocking.updateTrackerPrevalence(
    frame_host,
    getBaseDomain(frame_host),
    getBaseDomain(page_host)
  );

  // log for popup
  let action = checkAction(tab_id, frame_host);
  if (action) {
    badger.logThirdPartyOriginOnTab(tab_id, frame_host, action);
  }
}

/**
 * Record canvas fingerprinting
 *
 * @param {Integer} tab_id the tab ID
 * @param {Object} msg specific fingerprinting data
 */
function recordFingerprinting(tab_id, msg) {
  // exit if we failed to determine the originating script's URL
  if (!msg.scriptUrl) {
    // TODO find and fix where this happens
    return;
  } else if (msg.scriptUrl.startsWith("data:")) {
    // TODO find initiator for script data URLs
    return;
  }

  let document_host = badger.tabData.getFrameData(tab_id).host,
    script_host = "", script_path = "";

  try {
    let parsedScriptUrl = new URL(msg.scriptUrl);
    script_host = parsedScriptUrl.hostname;
    script_path = parsedScriptUrl.pathname;
  } catch (e) {
    console.error("Failed to parse URL of %s\n", msg.scriptUrl, e);
  }

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, script_host)) {
    script_host = badger.cnameDomains[script_host];
  }

  // ignore first-party scripts
  if (!utils.isThirdPartyDomain(script_host, document_host)) {
    return;
  }

  let CANVAS_WRITE = {
    fillText: true,
    strokeText: true
  };
  let CANVAS_READ = {
    getImageData: true,
    toDataURL: true
  };

  let script_base = getBaseDomain(script_host);

  let scriptData = badger.tabData.getScriptData(tab_id, script_base);

  if (utils.hasOwn(msg.extra, 'canvas')) {
    if (scriptData.canvas.fingerprinting) {
      return;
    }

    // If this script already had a canvas write...
    if (scriptData.canvas.write) {
      // ...and if this is a canvas read...
      if (utils.hasOwn(CANVAS_READ, msg.prop)) {
        // ...and it got enough data...
        if (msg.extra.width > 16 && msg.extra.height > 16) {
          // ...we will classify it as fingerprinting
          log(script_host, 'caught fingerprinting on', document_host);

          badger.tabData.logCanvasFingerprinting(tab_id, script_base);

          let document_base = getBaseDomain(document_host);

          // mark this as a strike
          badger.heuristicBlocking.updateTrackerPrevalence(
            script_host, script_base, document_base);

          // log for popup
          let action = checkAction(tab_id, script_host);
          if (action) {
            badger.logThirdPartyOriginOnTab(tab_id, script_host, action);
          }

          // record canvas fingerprinting
          badger.storage.recordTrackingDetails(
            script_base, document_base, 'canvas');
          badger.storage.recordFingerprintingScript(
            script_host, script_path);
        }
      }
      // This is a canvas write
    } else if (utils.hasOwn(CANVAS_WRITE, msg.prop)) {
      badger.tabData.logCanvasWrite(tab_id, script_base);
    }
  }
}

/**
 * Cleans up tab-specific data.
 *
 * @param {Integer} tab_id the ID of the tab
 * @param {Boolean} is_reload whether the page is simply being reloaded
 */
function forgetTab(tab_id, is_reload) {
  badger.tabData.forget(tab_id);
  if (!is_reload) {
    delete tempAllowlist[tab_id];
    delete tempAllowedWidgets[tab_id];
  }
}

/**
 * Determines the action to take on a specific FQDN.
 *
 * @param {Integer} tabId The relevant tab
 * @param {String} requestHost The FQDN
 * @param {Integer} frameId The id of the frame
 * @returns {(String|Boolean)} false or the action to take
 */
function checkAction(tabId, requestHost, frameId) {
  // Ignore requests from temporarily unblocked widgets.
  // Someone clicked the widget, so let it load.
  if (allowedOnTab(tabId, requestHost, frameId)) {
    return false;
  }

  // Ignore requests from private domains.
  if (isPrivateDomain(requestHost)) {
    return false;
  }

  return badger.storage.getBestAction(requestHost);
}

/**
 * Provides the widget replacing content script with list of widgets to replace.
 *
 * @param {Integer} tab_id the ID of the tab we're replacing widgets in
 *
 * @returns {Object} dict containing the complete list of widgets
 * as well as a mapping to indicate which ones should be replaced
 */
let getWidgetList = (function () {
  // cached translations
  let translations;

  // inputs to chrome.i18n.getMessage()
  const widgetTranslations = [
    {
      key: "social_tooltip_pb_has_replaced",
      placeholders: ["XXX"]
    },
    {
      key: "widget_placeholder_pb_has_replaced",
      placeholders: ["XXX", "YYY", "ZZZ"]
    },
    { key: "allow_once" },
    { key: "allow_on_site" },
  ];

  return function (tab_id) {
    // an object with keys set to widget names that should be replaced
    let widgetsToReplace = {},
      widgetList = [],
      trackers = badger.tabData.getTrackers(tab_id),
      trackerDomains = Object.keys(trackers),
      exceptions = badger.getSettings().getItem('widgetReplacementExceptions');

    // optimize translation lookups by doing them just once,
    // the first time they are needed
    if (!translations) {
      translations = widgetTranslations.reduce((memo, data) => {
        memo[data.key] = chrome.i18n.getMessage(data.key, data.placeholders);
        return memo;
      }, {});

      // TODO duplicated in src/lib/i18n.js
      const RTL_LOCALES = ['ar', 'he', 'fa'],
        UI_LOCALE = chrome.i18n.getMessage('@@ui_locale');
      translations.rtl = RTL_LOCALES.indexOf(UI_LOCALE) > -1;
    }

    for (let widget of badger.widgetList) {
      // replace only if the widget is not on the 'do not replace' list
      // also don't send widget data used later for dynamic replacement
      if (exceptions.includes(widget.name)) {
        continue;
      }

      widgetList.push(widget);

      // replace only if we haven't already allowed this widget for the tab/site
      // so that sites that dynamically insert nested frames with widgets
      // like Tumblr do the right thing after a widget is allowed
      // (but the page hasn't yet been reloaded)
      // and don't keep replacing an already allowed widget type in those frames
      if (utils.hasOwn(tempAllowedWidgets, tab_id) &&
          tempAllowedWidgets[tab_id].includes(widget.name)) {
        continue;
      }

      // replace only if at least one of the associated domains was blocked
      if (!trackerDomains.length) {
        continue;
      }
      let replace = widget.domains.some(domain => {
        // leading wildcard domain
        if (domain[0] == "*") {
          domain = domain.slice(1);
          // get all domains in tabData.trackers that end with this domain
          let matches = trackerDomains.filter(fqdn => {
            return fqdn.endsWith(domain);
          });
          // do we have any matches and are they all blocked?
          return matches.length && matches.every(fqdn => {
            const action = trackers[fqdn];
            return (
              action == constants.BLOCK ||
              action == constants.USER_BLOCK
            );
          });
        }

        // regular, non-leading wildcard domain
        if (!utils.hasOwn(trackers, domain)) {
          return false;
        }
        const action = trackers[domain];
        return (
          action == constants.BLOCK ||
          action == constants.USER_BLOCK
        );

      });
      if (replace) {
        widgetsToReplace[widget.name] = true;
      }
    }

    return {
      translations,
      widgetList,
      widgetsToReplace
    };
  };
}());

/**
 * Checks if given request FQDN is temporarily unblocked on a tab.
 *
 * The request is allowed if any of the following is true:
 *
 *   - 1a) Request FQDN matches an entry on the exception list for the tab
 *   - 1b) Request FQDN ends with a wildcard entry from the exception list
 *   - 2a) Request is from a subframe whose FQDN matches an entry on the list
 *   - 2b) Same but subframe's FQDN ends with a wildcard entry
 *
 * @param {Integer} tab_id the ID of the tab to check
 * @param {String} request_host the request FQDN to check
 * @param {Integer} frame_id the frame ID to check
 *
 * @returns {Boolean} true if FQDN is on the temporary allow list
 */
function allowedOnTab(tab_id, request_host, frame_id) {
  if (!utils.hasOwn(tempAllowlist, tab_id)) {
    return false;
  }

  let exceptions = tempAllowlist[tab_id];

  for (let exception of exceptions) {
    if (exception == request_host) {
      return true; // 1a
    // leading wildcard
    } else if (exception[0] == "*") {
      if (request_host.endsWith(exception.slice(1))) {
        return true; // 1b
      }
    }
  }

  if (!frame_id) {
    return false;
  }
  let frameData = badger.tabData.getFrameData(tab_id, frame_id);
  if (!frameData || !frameData.host) {
    return false;
  }

  let frame_host = frameData.host;
  for (let exception of exceptions) {
    if (exception == frame_host) {
      return true; // 2a
    // leading wildcard
    } else if (exception[0] == "*") {
      if (frame_host.endsWith(exception.slice(1))) {
        return true; // 2b
      }
    }
  }

  return false;
}

/**
 * @returns {Array|Boolean} the list of associated domains or false
 */
function getWidgetDomains(widget_name) {
  let widgetData = badger.widgetList.find(
    widget => widget.name == widget_name);

  if (!widgetData ||
      !utils.hasOwn(widgetData, "replacementButton") ||
      !widgetData.replacementButton.unblockDomains) {
    return false;
  }

  return widgetData.replacementButton.unblockDomains;
}

/**
 * Marks a set of (widget) domains to be (temporarily) allowed on a tab.
 *
 * @param {Integer} tab_id the ID of the tab
 * @param {Array} domains the domains
 * @param {String} widget_name the name (ID) of the widget
 */
function allowOnTab(tab_id, domains, widget_name) {
  if (!utils.hasOwn(tempAllowlist, tab_id)) {
    tempAllowlist[tab_id] = [];
  }
  for (let domain of domains) {
    if (!tempAllowlist[tab_id].includes(domain)) {
      tempAllowlist[tab_id].push(domain);
    }
  }

  if (!utils.hasOwn(tempAllowedWidgets, tab_id)) {
    tempAllowedWidgets[tab_id] = [];
  }
  tempAllowedWidgets[tab_id].push(widget_name);
}

/**
 * Called upon navigation to prepopulate the temporary allowlist
 * with domains for widgets marked as always allowed on a given site.
 */
function initAllowedWidgets(tab_id, tab_host) {
  let allowedWidgets = badger.getSettings().getItem('widgetSiteAllowlist');
  if (utils.hasOwn(allowedWidgets, tab_host)) {
    for (let widget_name of allowedWidgets[tab_host]) {
      let widgetDomains = getWidgetDomains(widget_name);
      if (widgetDomains) {
        allowOnTab(tab_id, widgetDomains, widget_name);
      }
    }
  }
}

/**
 * Generates widget objects for surrogate-initiated widgets.
 *
 * @param {String} name UNTRUSTED widget name
 * @param {Object} data UNTRUSTED widget-specific data
 * @param {String} frame_url containing frame URL, used by some widgets
 *
 * @returns {Object|false}
 */
function getSurrogateWidget(name, data, frame_url) {
  const OK = /^[A-Za-z0-9_-]+$/;

  if (name == "Rumble Video Player") {
    // validate
    if (!data || !data.args || data.args[0] != "play") {
      return false;
    }

    let pub_code = data.pubCode,
      { video, div } = data.args[1];

    if (!OK.test(pub_code) || !OK.test(video) || !OK.test(div)) {
      return false;
    }

    let argsParam = [ "play", { video, div } ];

    let script_url = `https://rumble.com/embedJS/${encodeURIComponent(pub_code)}.${encodeURIComponent(video)}/?url=${encodeURIComponent(frame_url)}&args=${encodeURIComponent(JSON.stringify(argsParam))}`;

    return {
      name,
      buttonSelectors: ["div#" + div],
      scriptSelectors: [`script[src='${CSS.escape(script_url)}']`],
      replacementButton: {
        "unblockDomains": ["rumble.com"],
        "type": 4
      },
      directLinkUrl: `https://rumble.com/embed/${encodeURIComponent(pub_code)}.${encodeURIComponent(video)}/`
    };
  }

  if (name == "Google reCAPTCHA") {
    const KNOWN_GRECAPTCHA_SCRIPTS = [
      "https://www.google.com/recaptcha/",
      "https://www.recaptcha.net/recaptcha/",
    ];

    // validate
    if (!data || !data.domId || !data.scriptUrl) {
      return false;
    }

    let dom_id = data.domId,
      script_url = data.scriptUrl;

    if (!OK.test(dom_id) || !KNOWN_GRECAPTCHA_SCRIPTS.some(s => script_url.startsWith(s))) {
      return false;
    }

    return {
      name,
      buttonSelectors: ["#" + dom_id],
      scriptSelectors: [`script[src='${CSS.escape(script_url)}']`],
      replacementButton: {
        "unblockDomains": ["www.google.com"],
        "type": 4
      }
    };
  }

  if (name == "YouTube") {
    if (!data || !data.domId || !data.videoId) {
      return false;
    }

    let video_id = data.videoId,
      dom_id = data.domId;

    if (!OK.test(video_id) || !OK.test(dom_id)) {
      return false;
    }

    let widget = {
      name,
      buttonSelectors: ["#" + dom_id],
      scriptSelectors: [
        `script[src^='${CSS.escape("https://www.youtube.com/iframe_api")}']`,
        `script[src^='${CSS.escape("https://www.youtube.com/player_api")}']`
      ],
      replacementButton: {
        "unblockDomains": ["www.youtube.com"],
        "type": 4
      },
      directLinkUrl: `https://www.youtube.com/embed/${video_id}`
    };

    return widget;
  }

  return false;
}

// NOTE: sender.tab is available for content script (not popup) messages only
function dispatcher(request, sender, sendResponse) {
  if (!badger.INITIALIZED) {
    return sendResponse();
  }

  // messages from content scripts are to be treated with greater caution:
  // https://groups.google.com/a/chromium.org/d/msg/chromium-extensions/0ei-UCHNm34/lDaXwQhzBAAJ
  if (!sender.url.startsWith(chrome.runtime.getURL(""))) {
    // reject unless it's a known content script message
    const KNOWN_CONTENT_SCRIPT_MESSAGES = [
      "allowWidgetOnSite",
      "checkDNT",
      "checkEnabled",
      "checkLocation",
      "checkWidgetReplacementEnabled",
      "detectFingerprinting",
      "fpReport",
      "getBlockedFrameUrls",
      "getReplacementButton",
      "inspectLocalStorage",
      "supercookieReport",
      "unblockWidget",
      "widgetFromSurrogate",
      "widgetReplacementReady",
    ];
    if (!KNOWN_CONTENT_SCRIPT_MESSAGES.includes(request.type)) {
      console.error("Rejected unknown message %o from %s", request, sender.url);
      return sendResponse();
    }

    // also reject messages from special pages like chrome://new-tab-page/
    // our content scripts still run there, for example in YouTube embed frames
    if (sender.tab && sender.tab.url && utils.isRestrictedUrl(sender.tab.url)) {
      return sendResponse();
    }
  }

  switch (request.type) {

  case "checkEnabled": {
    sendResponse(badger.isPrivacyBadgerEnabled(
      extractHostFromURL(sender.tab.url)
    ));

    break;
  }

  case "checkLocation": {
    let tab_host = extractHostFromURL(sender.tab.url);

    if (!badger.isPrivacyBadgerEnabled(tab_host)) {
      return sendResponse();
    }

    let frame_host = extractHostFromURL(request.frameUrl);

    // CNAME uncloaking
    if (utils.hasOwn(badger.cnameDomains, frame_host)) {
      frame_host = badger.cnameDomains[frame_host];
    }

    // Ignore requests that aren't from a third party.
    if (!frame_host || !utils.isThirdPartyDomain(frame_host, tab_host)) {
      return sendResponse();
    }

    let action = checkAction(sender.tab.id, frame_host);
    sendResponse(action == constants.COOKIEBLOCK || action == constants.USER_COOKIEBLOCK);

    break;
  }

  case "getBlockedFrameUrls": {
    if (!badger.isPrivacyBadgerEnabled(extractHostFromURL(sender.tab.url))) {
      return sendResponse();
    }
    let tab_id = sender.tab.id,
      frame_id = sender.frameId,
      tabData = badger.tabData.has(tab_id) && badger.tabData._tabData[tab_id],
      blockedFrameUrls = tabData &&
        utils.hasOwn(tabData.blockedFrameUrls, frame_id) &&
        tabData.blockedFrameUrls[frame_id];
    sendResponse(blockedFrameUrls);
    break;
  }

  case "unblockWidget": {
    let widgetDomains = getWidgetDomains(request.widgetName);
    if (!widgetDomains) {
      return sendResponse();
    }
    allowOnTab(sender.tab.id, widgetDomains, request.widgetName);
    sendResponse();
    break;
  }

  case "allowWidgetOnSite": {
    // record that we always want to activate this widget on this site
    let tab_host = extractHostFromURL(sender.tab.url),
      allowedWidgets = badger.getSettings().getItem('widgetSiteAllowlist');
    if (!utils.hasOwn(allowedWidgets, tab_host)) {
      allowedWidgets[tab_host] = [];
    }
    if (!allowedWidgets[tab_host].includes(request.widgetName)) {
      allowedWidgets[tab_host].push(request.widgetName);
      badger.getSettings().setItem('widgetSiteAllowlist', allowedWidgets);
    }
    sendResponse();
    break;
  }

  case "getReplacementButton": {
    let widgetData = badger.widgetList.find(
      widget => widget.name == request.widgetName);
    if (!widgetData ||
        !utils.hasOwn(widgetData, "replacementButton") ||
        !widgetData.replacementButton.imagePath) {
      return sendResponse();
    }

    let button_path = chrome.runtime.getURL(
      "skin/socialwidgets/" + widgetData.replacementButton.imagePath);

    // fetch replacement button SVG image data
    utils.fetchResource(button_path, function (_, response) {
      return sendResponse('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(response));
    }, "GET");

    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "fpReport": {
    request.data.forEach(function (msg) {
      recordFingerprinting(sender.tab.id, msg);
    });
    break;
  }

  case "supercookieReport": {
    if (request.frameUrl && badger.hasSupercookie(request.data)) {
      recordSupercookie(sender.tab.id, request.frameUrl);
    }
    break;
  }

  case "inspectLocalStorage": {
    let tab_host = extractHostFromURL(sender.tab.url),
      frame_host = extractHostFromURL(request.frameUrl);

    // CNAME uncloaking
    if (utils.hasOwn(badger.cnameDomains, frame_host)) {
      frame_host = badger.cnameDomains[frame_host];
    }

    sendResponse(frame_host &&
      badger.isLearningEnabled(sender.tab.id) &&
      badger.isPrivacyBadgerEnabled(tab_host) &&
      utils.isThirdPartyDomain(frame_host, tab_host));

    break;
  }

  case "detectFingerprinting": {
    let tab_host = extractHostFromURL(sender.tab.url);

    sendResponse(
      badger.isLearningEnabled(sender.tab.id) &&
      badger.isPrivacyBadgerEnabled(tab_host));

    break;
  }

  case "checkWidgetReplacementEnabled": {
    let response = false,
      tab_host = extractHostFromURL(sender.tab.url);

    if (badger.isPrivacyBadgerEnabled(tab_host) &&
        badger.getSettings().getItem("socialWidgetReplacementEnabled")) {
      response = getWidgetList(sender.tab.id);
      response.frameId = sender.frameId;
    }

    sendResponse(response);

    break;
  }

  case "getPopupData": {
    let tab_id = request.tabId;

    if (!badger.tabData.has(tab_id)) {
      sendResponse({
        criticalError: badger.criticalError,
        noTabData: true,
        settings: { seenComic: true },
      });
      break;
    }

    let tab_host = extractHostFromURL(request.tabUrl),
      trackers = badger.tabData.getTrackers(tab_id),
      cookieblocked = {};

    for (let fqdn in trackers) {
      // see if fqdn would be cookieblocked if not for user override
      if (badger.storage.wouldGetCookieblocked(fqdn)) {
        cookieblocked[fqdn] = true;
      }
    }

    sendResponse({
      blockedFpScripts: badger.tabData._tabData[tab_id].blockedFpScripts,
      cookieblocked,
      criticalError: badger.criticalError,
      enabled: badger.isPrivacyBadgerEnabled(tab_host),
      errorText: badger.tabData._tabData[tab_id].errorText,
      isOnFirstParty: utils.firstPartyProtectionsEnabled(tab_host),
      noTabData: false,
      origins: trackers,
      settings: badger.getSettings().getItemClones(),
      showLearningPrompt: badger.getPrivateSettings().getItem("showLearningPrompt"),
      shownBreakageNotes: badger.getPrivateSettings().getItem("shownBreakageNotes"),
      tabHost: tab_host,
      tabId: tab_id,
      tabUrl: request.tabUrl,
      trackerCount: badger.getTrackerCount(tab_id)
    });

    break;
  }

  case "getOptionsData": {
    let trackers = badger.storage.getTrackingDomains();

    let cookieblocked = {};
    for (let fqdn in trackers) {
      // see if fqdn would be cookieblocked if not for user override
      if (badger.storage.wouldGetCookieblocked(fqdn)) {
        cookieblocked[fqdn] = true;
      }
    }

    sendResponse({
      cookieblocked,
      origins: trackers,
      settings: badger.getSettings().getItemClones(),
      widgets: badger.widgetList.map(widget => widget.name),
    });

    break;
  }

  case "getOptionsDomainTooltip": {
    let base = getBaseDomain(request.domain);
    sendResponse({
      base,
      snitchMap: badger.storage.getStore('snitch_map').getItem(base),
      trackingMap: badger.storage.getStore('tracking_map').getItem(base)
    });
    break;
  }

  case "resetData": {
    badger.storage.clearTrackerData();
    badger.loadSeedData(err => {
      if (err) {
        console.error(err);
      }
      badger.blockWidgetDomains();
      badger.blockPanopticlickDomains();
      sendResponse();
    });
    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "removeAllData": {
    badger.storage.clearTrackerData();
    sendResponse();
    break;
  }

  // used by tests
  case "checkForDntPolicy": {
    badger.checkForDNTPolicy(request.domain, sendResponse);
    return true; // async chrome.runtime.onMessage response
  }

  // used by tests
  case "getTabData": {
    sendResponse(badger.tabData._tabData);
    break;
  }

  // used by tests
  case "isBadgerInitialized": {
    sendResponse(badger.INITIALIZED);
    break;
  }

  // used by tests
  case "syncStorage": {
    badger.storage.forceSync(request.storeName, (err) => {
      sendResponse(err);
    });
    return true; // async chrome.runtime.onMessage response
  }

  // used by tests
  case "setAction": {
    let action = request.action;
    if ([constants.ALLOW, constants.BLOCK, constants.COOKIEBLOCK].includes(action)) {
      if (request.domain) {
        badger.storage.setupHeuristicAction(request.domain, action);
      }
    }
    sendResponse();
    break;
  }

  // used by tests
  case "setDnt": {
    badger.storage.setupDNT(request.domain);
    sendResponse();
    break;
  }

  // used by tests
  case "setDntHashes": {
    badger.storage.updateDntHashes(request.value);
    sendResponse();
    break;
  }

  // used by tests
  case "setWidgetList": {
    badger.widgetList = request.value;
    sendResponse();
    break;
  }

  // used by tests
  case "disableSurrogates": {
    window.SURROGATES_DISABLED = true;
    sendResponse();
    break;
  }

  // used by tests
  case "restoreSurrogates": {
    delete window.SURROGATES_DISABLED;
    sendResponse();
    break;
  }

  // used by Badger Sett
  case "setBlockThreshold": {
    let value = +request.value;
    if (value > 0) {
      badger.getPrivateSettings().setItem("blockThreshold", value);
    }
    sendResponse();
    break;
  }

  case "seenLearningPrompt": {
    badger.getPrivateSettings().setItem("showLearningPrompt", false);
    sendResponse();
    break;
  }

  case "seenBreakageNote": {
    if (request.domain) {
      let privateStore = badger.getPrivateSettings(),
        shownBreakageNotes = privateStore.getItem("shownBreakageNotes");
      if (!shownBreakageNotes.includes(request.domain)) {
        shownBreakageNotes.push(request.domain);
      }
      badger.getPrivateSettings().setItem("shownBreakageNotes", shownBreakageNotes);
    }
    sendResponse();
    break;
  }

  case "reenableOnSiteFromPopup": {
    badger.reenableOnSite(request.tabHost);
    badger.updateIcon(request.tabId, request.tabUrl);
    sendResponse();
    break;
  }

  case "disableOnSiteFromPopup": {
    badger.disableOnSite(request.tabHost);
    badger.updateIcon(request.tabId, request.tabUrl);
    sendResponse();
    break;
  }

  case "revertDomainControl": {
    badger.storage.revertUserAction(request.origin);
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  case "downloadCloud": {
    chrome.storage.sync.get("disabledSites", function (store) {
      if (chrome.runtime.lastError) {
        sendResponse({success: false, message: chrome.runtime.lastError.message});
      } else if (utils.hasOwn(store, "disabledSites")) {
        let disabledSites = utils.concatUniq(
          badger.getDisabledSites(),
          store.disabledSites
        );
        badger.getSettings().setItem("disabledSites", disabledSites);
        sendResponse({
          success: true,
          disabledSites
        });
      } else {
        sendResponse({
          success: false,
          message: chrome.i18n.getMessage("download_cloud_no_data")
        });
      }
    });

    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "uploadCloud": {
    let obj = {};
    obj.disabledSites = badger.getDisabledSites();
    chrome.storage.sync.set(obj, function () {
      if (chrome.runtime.lastError) {
        sendResponse({success: false, message: chrome.runtime.lastError.message});
      } else {
        sendResponse({success: true});
      }
    });
    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "savePopupToggle": {
    let domain = request.origin,
      action = request.action;

    badger.saveAction(action, domain);

    // update cached tab data so that a reopened popup displays correct state
    badger.tabData.logTracker(request.tabId, domain, "user_" + action);

    break;
  }

  // called when the user manually sets a slider on the options page
  case "saveOptionsToggle": {
    badger.saveAction(request.action, request.origin);
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  // used by Badger Sett
  case "mergeData": {
    badger.mergeUserData(request.data);
    sendResponse();
    break;
  }

  // called when a user imports data exported from another Badger instance
  case "mergeUserData": {
    badger.mergeUserData(request.data);
    badger.blockWidgetDomains();
    badger.setPrivacyOverrides();
    badger.initDeprecations();

    // for exports from older Privacy Badger versions:
    // fix yellowlist getting out of sync, remove non-tracking domains, etc.
    badger.runMigrations();

    sendResponse();
    break;
  }

  case "updateSettings": {
    const settings = badger.getSettings();
    for (let key in request.data) {
      if (utils.hasOwn(badger.defaultSettings, key)) {
        settings.setItem(key, request.data[key]);
      } else {
        console.error("Unknown Badger setting:", key);
      }
    }
    sendResponse();
    break;
  }

  case "setPrivacyOverrides": {
    badger.setPrivacyOverrides();
    sendResponse();
    break;
  }

  case "updateBadge": {
    let tab_id = request.tab_id;
    badger.updateBadge(tab_id);
    sendResponse();
    break;
  }

  case "disableOnSite": {
    badger.disableOnSite(request.domain);
    sendResponse({
      disabledSites: badger.getDisabledSites()
    });
    break;
  }

  case "reenableOnSites": {
    request.domains.forEach(function (domain) {
      badger.reenableOnSite(domain);
    });
    sendResponse({
      disabledSites: badger.getDisabledSites()
    });
    break;
  }

  case "removeWidgetSiteExceptions": {
    let settings = badger.getSettings(),
      allowedWidgets = settings.getItem("widgetSiteAllowlist");

    for (let domain of request.domains) {
      delete allowedWidgets[domain];
    }

    settings.setItem("widgetSiteAllowlist", allowedWidgets);

    sendResponse({
      widgetSiteAllowlist: allowedWidgets
    });

    break;
  }

  case "removeOrigin": {
    for (let name of ['snitch_map', 'action_map', 'tracking_map', 'fp_scripts']) {
      badger.storage.getStore(name).deleteItem(request.origin);
    }
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  case "saveErrorText": {
    let activeTab = badger.tabData._tabData[request.tabId];
    activeTab.errorText = request.errorText;
    break;
  }

  case "removeErrorText": {
    let activeTab = badger.tabData._tabData[request.tabId];
    delete activeTab.errorText;
    break;
  }

  // called from contentscripts/dnt.js
  // to check if it should set DNT on Navigator
  case "checkDNT": {
    let tab_host = extractHostFromURL(sender.tab.url);
    sendResponse(
      badger.isDntSignalEnabled(tab_host) &&
      badger.isPrivacyBadgerEnabled(tab_host));
    break;
  }

  // proxies surrogate script-initiated widget replacement messages
  // from one content script to another
  case "widgetFromSurrogate": {
    let tab_host = extractHostFromURL(sender.tab.url);
    if (!badger.isPrivacyBadgerEnabled(tab_host)) {
      break;
    }

    // NOTE: request.name and request.data are not to be trusted
    // https://github.com/w3c/webextensions/issues/57#issuecomment-914491167
    // https://github.com/w3c/webextensions/issues/78#issuecomment-921058071
    let widget = getSurrogateWidget(request.name, request.data, request.frameUrl);

    if (!widget) {
      break;
    }

    let frameData = badger.tabData.getFrameData(sender.tab.id, sender.frameId);

    if (frameData.widgetReplacementReady) {
      // message the content script if it's ready for messages
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "replaceWidgetFromSurrogate",
        frameId: sender.frameId,
        widget
      });
    } else {
      // save the message for later otherwise
      if (!utils.hasOwn(frameData, "widgetQueue")) {
        frameData.widgetQueue = [];
      }
      frameData.widgetQueue.push(widget);
    }

    break;
  }

  // marks the widget replacement script in a certain tab/frame
  // ready for messages; sends any previously saved messages
  case "widgetReplacementReady": {
    let frameData = badger.tabData.getFrameData(sender.tab.id, sender.frameId);
    if (!frameData) {
      break;
    }

    frameData.widgetReplacementReady = true;
    if (frameData.widgetQueue) {
      for (let widget of frameData.widgetQueue) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "replaceWidgetFromSurrogate",
          frameId: sender.frameId,
          widget
        });
      }
      delete frameData.widgetQueue;
    }

    break;
  }

  }
}

/*************** Event Listeners *********************/
function startListeners() {
  chrome.webNavigation.onCommitted.addListener(onNavigate);

  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);

  chrome.webRequest.onBeforeRequest.addListener(filterWarRequests, {
    urls: chrome.runtime.getManifest().web_accessible_resources.map(
      path => chrome.runtime.getURL(path))
  }, ['blocking']);

  // this is Firefox-only because the key is 'REQUEST_BODY' in Chrome
  if (utils.hasOwn(chrome.webRequest.OnBeforeRequestOptions, 'REQUESTBODY')) {
    chrome.webRequest.onBeforeRequest.addListener(blockMozCspReports, {
      types: ['csp_report'],
      urls: ['<all_urls>']
    }, ['blocking', 'requestBody']);
  }

  let extraInfoSpec = ['requestHeaders', 'blocking'];
  if (utils.hasOwn(chrome.webRequest.OnBeforeSendHeadersOptions, 'EXTRA_HEADERS')) {
    extraInfoSpec.push('extraHeaders');
  }
  chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*", "https://*/*"]}, extraInfoSpec);

  extraInfoSpec = ['responseHeaders', 'blocking'];
  if (utils.hasOwn(chrome.webRequest.OnHeadersReceivedOptions, 'EXTRA_HEADERS')) {
    extraInfoSpec.push('extraHeaders');
  }
  chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["<all_urls>"]}, extraInfoSpec);

  chrome.tabs.onRemoved.addListener(onTabRemoved);
  chrome.tabs.onReplaced.addListener(onTabReplaced);
  chrome.runtime.onMessage.addListener(dispatcher);
}

export default {
  startListeners
};
