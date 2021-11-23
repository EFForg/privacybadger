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

/* globals badger:false, log:false */

require.scopes.webrequest = (function () {

/*********************** webrequest scope **/

let constants = require("constants"),
  incognito = require("incognito"),
  surrogates = require("surrogates"),
  utils = require("utils");

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
  let frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url;

  if (type == "main_frame") {
    let oldTabData = badger.getFrameData(tab_id),
      is_reload = oldTabData && oldTabData.url == url;
    forgetTab(tab_id, is_reload);
    badger.recordFrame(tab_id, frame_id, url);
    initAllowedWidgets(tab_id, badger.getFrameData(tab_id).host);
    return {};
  }

  if (type == "sub_frame") {
    badger.recordFrame(tab_id, frame_id, url);
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

  let tab_host = getHostForTab(tab_id);
  let request_host = window.extractHostFromURL(url);

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, request_host)) {
    request_host = badger.cnameDomains[request_host];
  }

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    return {};
  }

  let action = checkAction(tab_id, request_host, frame_id);
  if (!action) {
    return {};
  }

  badger.logThirdPartyOriginOnTab(tab_id, request_host, action);

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return {};
  }

  if (action != constants.BLOCK && action != constants.USER_BLOCK) {
    return {};
  }

  if (type == 'script') {
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
    frameData = badger.getFrameData(tab_id, frame_id),
    tokens = frameData.warAccessTokens;

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
  let url = details.url,
    frameData = badger.getFrameData(details.tabId, details.frameId),
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
 * Filters outgoing cookies and referer
 * Injects DNT
 *
 * @param {Object} details Event details
 * @returns {Object} modified headers
 */
function onBeforeSendHeaders(details) {
  let frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url;

  if (_isTabChromeInternal(tab_id)) {
    // DNT policy requests: strip cookies
    if (type == "xmlhttprequest" && url.endsWith("/.well-known/dnt-policy.txt")) {
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

    return {};
  }

  let tab_host = getHostForTab(tab_id);
  let request_host = window.extractHostFromURL(url);

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, request_host)) {
    request_host = badger.cnameDomains[request_host];
  }

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    if (badger.isPrivacyBadgerEnabled(tab_host)) {
      // Still sending Do Not Track even if HTTP and cookie blocking are disabled
      if (badger.isDNTSignalEnabled()) {
        if (tab_host == 'www.costco.com') {
          details.requestHeaders.push({name: "Sec-GPC", value: "1"});
        } else {
          details.requestHeaders.push({name: "DNT", value: "1"}, {name: "Sec-GPC", value: "1"});
        }
      }
      return {requestHeaders: details.requestHeaders};
    } else {
      return {};
    }
  }

  let action = checkAction(tab_id, request_host, frame_id);

  if (action) {
    badger.logThirdPartyOriginOnTab(tab_id, request_host, action);
  }

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return {};
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
    if (badger.isDNTSignalEnabled()) {
      newHeaders.push({name: "DNT", value: "1"}, {name: "Sec-GPC", value: "1"});
    }

    return {requestHeaders: newHeaders};
  }

  // if we are here, we're looking at a third-party request
  // that's not yet blocked or cookieblocked
  if (badger.isDNTSignalEnabled()) {
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
  let tab_id = details.tabId,
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

  if (details.type == 'main_frame' && badger.isFlocOverwriteEnabled()) {
    let responseHeaders = details.responseHeaders || [];
    responseHeaders.push({
      name: 'permissions-policy',
      value: 'interest-cohort=()'
    });
    return { responseHeaders };
  }

  let tab_host = getHostForTab(tab_id);
  let response_host = window.extractHostFromURL(url);

  // CNAME uncloaking
  if (utils.hasOwn(badger.cnameDomains, response_host)) {
    response_host = badger.cnameDomains[response_host];
  }

  if (!utils.isThirdPartyDomain(response_host, tab_host)) {
    return {};
  }

  let action = checkAction(tab_id, response_host, details.frameId);
  if (!action) {
    return {};
  }

  badger.logThirdPartyOriginOnTab(tab_id, response_host, action);

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return {};
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
  forgetTab(tabId);
}

/**
 * Update internal db on tabs when a tab gets replaced
 * due to prerendering or instant search.
 *
 * @param {Integer} addedTabId The new tab id that replaces
 * @param {Integer} removedTabId The tab id that gets removed
 */
function onTabReplaced(addedTabId, removedTabId) {
  forgetTab(removedTabId);
  // Update the badge of the added tab, which was probably used for prerendering.
  badger.updateBadge(addedTabId);
}

/**
 * We don't always get a "main_frame" details object in onBeforeRequest,
 * so we need a fallback for (re)initializing tabData.
 */
function onNavigate(details) {
  const tab_id = details.tabId,
    url = details.url;

  // main (top-level) frames only
  if (details.frameId !== 0) {
    return;
  }

  let oldTabData = badger.getFrameData(tab_id),
    is_reload = oldTabData && oldTabData.url == url;

  forgetTab(tab_id, is_reload);

  // forget but don't initialize on special browser/extension pages
  if (utils.isRestrictedUrl(url)) {
    return;
  }

  badger.recordFrame(tab_id, 0, url);

  let tab_host = badger.getFrameData(tab_id).host;

  initAllowedWidgets(tab_id, tab_host);

  // initialize tab data bookkeeping used by heuristicBlockingAccounting()
  // to avoid missing or misattributing learning
  // when there is no "main_frame" webRequest callback
  // (such as on Service Worker pages)
  //
  // see the tabOrigins TODO in heuristicblocking.js
  // as to why we don't just use tabData
  let base = window.getBaseDomain(tab_host);
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
    let tabData = badger.tabData[tab_id];
    if (!utils.hasOwn(tabData.blockedFrameUrls, parent_frame_id)) {
      tabData.blockedFrameUrls[parent_frame_id] = [];
    }
    tabData.blockedFrameUrls[parent_frame_id].push(frame_url);
  });
}

/**
 * Gets the host name for a given tab id
 * @param {Integer} tabId chrome tab id
 * @return {String} the host name for the tab
 */
function getHostForTab(tabId) {
  let mainFrameIdx = 0;
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
  let frameData = badger.getFrameData(tabId, mainFrameIdx);
  if (!frameData) {
    return '';
  }
  return frameData.host;
}

/**
 * Record "supercookie" tracking
 *
 * @param {Integer} tab_id browser tab ID
 * @param {String} frame_url URL of the frame with supercookie
 */
function recordSupercookie(tab_id, frame_url) {
  const frame_host = window.extractHostFromURL(frame_url),
    page_host = badger.getFrameData(tab_id).host;

  badger.heuristicBlocking.updateTrackerPrevalence(
    frame_host,
    window.getBaseDomain(frame_host),
    window.getBaseDomain(page_host)
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

  let document_host = badger.getFrameData(tab_id).host,
    script_host = window.extractHostFromURL(msg.scriptUrl);

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

  if (!utils.hasOwn(badger.tabData[tab_id], 'fpData')) {
    badger.tabData[tab_id].fpData = {};
  }

  let script_base = window.getBaseDomain(script_host);

  // Initialize script TLD-level data
  if (!utils.hasOwn(badger.tabData[tab_id].fpData, script_base)) {
    badger.tabData[tab_id].fpData[script_base] = {
      canvas: {
        fingerprinting: false,
        write: false
      }
    };
  }
  let scriptData = badger.tabData[tab_id].fpData[script_base];

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
          scriptData.canvas.fingerprinting = true;
          log(script_host, 'caught fingerprinting on', document_host);

          // mark this as a strike
          badger.heuristicBlocking.updateTrackerPrevalence(
            script_host, script_base, window.getBaseDomain(document_host));

          // log for popup
          let action = checkAction(tab_id, script_host);
          if (action) {
            badger.logThirdPartyOriginOnTab(tab_id, script_host, action);
          }
        }
      }
      // This is a canvas write
    } else if (utils.hasOwn(CANVAS_WRITE, msg.prop)) {
      scriptData.canvas.write = true;
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
  delete badger.tabData[tab_id];
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
  if (window.isPrivateDomain(requestHost)) {
    return false;
  }

  return badger.storage.getBestAction(requestHost);
}

/**
 * Checks if the tab is chrome internal
 *
 * @param {Integer} tabId Id of the tab to test
 * @returns {boolean} Returns true if the tab is chrome internal
 * @private
 */
function _isTabChromeInternal(tabId) {
  if (tabId < 0) {
    return true;
  }

  let frameData = badger.getFrameData(tabId);
  if (!frameData || !frameData.url.startsWith("http")) {
    return true;
  }

  return false;
}

/**
 * Checks if the tab is a chrome-extension tab
 *
 * @param {Integer} tabId Id of the tab to test
 * @returns {boolean} Returns true if the tab is from a chrome-extension
 * @private
 */
function _isTabAnExtension(tabId) {
  let frameData = badger.getFrameData(tabId);
  return (frameData && (
    frameData.url.startsWith("chrome-extension://") ||
    frameData.url.startsWith("moz-extension://")
  ));
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
      tabData = badger.tabData[tab_id],
      tabOrigins = tabData && tabData.origins && Object.keys(tabData.origins),
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
      if (!tabOrigins || !tabOrigins.length) {
        continue;
      }
      let replace = widget.domains.some(domain => {
        // leading wildcard domain
        if (domain[0] == "*") {
          domain = domain.slice(1);
          // get all domains in tabData.origins that end with this domain
          let matches = tabOrigins.filter(origin => {
            return origin.endsWith(domain);
          });
          // do we have any matches and are they all blocked?
          return matches.length && matches.every(origin => {
            const action = tabData.origins[origin];
            return (
              action == constants.BLOCK ||
              action == constants.USER_BLOCK
            );
          });
        }

        // regular, non-leading wildcard domain
        if (!utils.hasOwn(tabData.origins, domain)) {
          return false;
        }
        const action = tabData.origins[domain];
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
  let frameData = badger.getFrameData(tab_id, frame_id);
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

  return false;
}

// NOTE: sender.tab is available for content script (not popup) messages only
function dispatcher(request, sender, sendResponse) {

  // messages from content scripts are to be treated with greater caution:
  // https://groups.google.com/a/chromium.org/d/msg/chromium-extensions/0ei-UCHNm34/lDaXwQhzBAAJ
  if (!sender.url.startsWith(chrome.runtime.getURL(""))) {
    // reject unless it's a known content script message
    const KNOWN_CONTENT_SCRIPT_MESSAGES = [
      "allowWidgetOnSite",
      "checkDNT",
      "checkEnabled",
      "checkFloc",
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
  }

  switch (request.type) {

  case "checkEnabled": {
    sendResponse(badger.isPrivacyBadgerEnabled(
      window.extractHostFromURL(sender.tab.url)
    ));

    break;
  }

  case "checkLocation": {
    if (!badger.isPrivacyBadgerEnabled(window.extractHostFromURL(sender.tab.url))) {
      return sendResponse();
    }

    // Ignore requests from internal Chrome tabs.
    if (_isTabChromeInternal(sender.tab.id)) {
      return sendResponse();
    }

    let frame_host = window.extractHostFromURL(request.frameUrl),
      tab_host = window.extractHostFromURL(sender.tab.url);

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
    if (!badger.isPrivacyBadgerEnabled(window.extractHostFromURL(sender.tab.url))) {
      return sendResponse();
    }
    let tab_id = sender.tab.id,
      frame_id = sender.frameId,
      tabData = utils.hasOwn(badger.tabData, tab_id) && badger.tabData[tab_id],
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
    let tab_host = window.extractHostFromURL(sender.tab.url),
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

    let image_type = button_path.slice(button_path.lastIndexOf('.') + 1);

    let xhrOptions = {};
    if (image_type != "svg") {
      xhrOptions.responseType = "arraybuffer";
    }

    // fetch replacement button image data
    utils.xhrRequest(button_path, function (err, response) {
      // one data URI for SVGs
      if (image_type == "svg") {
        return sendResponse('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(response));
      }

      // another data URI for all other image formats
      sendResponse(
        'data:image/' + image_type + ';base64,' +
        utils.arrayBufferToBase64(response)
      );
    }, "GET", xhrOptions);

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
    let tab_host = window.extractHostFromURL(sender.tab.url),
      frame_host = window.extractHostFromURL(request.frameUrl);

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
    let tab_host = window.extractHostFromURL(sender.tab.url);

    sendResponse(
      badger.isLearningEnabled(sender.tab.id) &&
      badger.isPrivacyBadgerEnabled(tab_host));

    break;
  }

  case "checkWidgetReplacementEnabled": {
    let response = false,
      tab_host = window.extractHostFromURL(sender.tab.url);

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

    if (!utils.hasOwn(badger.tabData, tab_id)) {
      sendResponse({
        criticalError: badger.criticalError,
        noTabData: true,
        settings: { seenComic: true },
      });
      break;
    }

    let tab_host = window.extractHostFromURL(request.tabUrl),
      origins = badger.tabData[tab_id].origins,
      cookieblocked = {};

    for (let origin in origins) {
      // see if origin would be cookieblocked if not for user override
      if (badger.storage.wouldGetCookieblocked(origin)) {
        cookieblocked[origin] = true;
      }
    }

    sendResponse({
      cookieblocked,
      criticalError: badger.criticalError,
      enabled: badger.isPrivacyBadgerEnabled(tab_host),
      errorText: badger.tabData[tab_id].errorText,
      isOnFirstParty: utils.firstPartyProtectionsEnabled(tab_host),
      noTabData: false,
      origins,
      settings: badger.getSettings().getItemClones(),
      showLearningPrompt: badger.getPrivateSettings().getItem("showLearningPrompt"),
      showWebRtcDeprecation: !!badger.getPrivateSettings().getItem("showWebRtcDeprecation"),
      tabHost: tab_host,
      tabId: tab_id,
      tabUrl: request.tabUrl,
      trackerCount: badger.getTrackerCount(tab_id)
    });

    break;
  }

  case "getOptionsData": {
    let origins = badger.storage.getTrackingDomains();

    let cookieblocked = {};
    for (let origin in origins) {
      // see if origin would be cookieblocked if not for user override
      if (badger.storage.wouldGetCookieblocked(origin)) {
        cookieblocked[origin] = true;
      }
    }

    sendResponse({
      cookieblocked,
      legacyWebRtcProtectionUser: badger.getPrivateSettings().getItem("legacyWebRtcProtectionUser"),
      origins,
      settings: badger.getSettings().getItemClones(),
      webRTCAvailable: badger.webRTCAvailable,
      widgets: badger.widgetList.map(widget => widget.name),
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

  case "seenComic": {
    badger.getSettings().setItem("seenComic", true);
    sendResponse();
    break;
  }

  case "seenLearningPrompt": {
    badger.getPrivateSettings().setItem("showLearningPrompt", false);
    sendResponse();
    break;
  }

  case "seenWebRtcDeprecation": {
    badger.getPrivateSettings().setItem("showWebRtcDeprecation", false);
    badger.updateBadge(request.tabId);
    sendResponse();
    break;
  }

  case "activateOnSite": {
    badger.enablePrivacyBadgerForOrigin(request.tabHost);
    badger.updateIcon(request.tabId, request.tabUrl);
    sendResponse();
    break;
  }

  case "deactivateOnSite": {
    badger.disablePrivacyBadgerForOrigin(request.tabHost);
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
    badger.tabData[request.tabId].origins[domain] = "user_" + action;

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

  case "disablePrivacyBadgerForOrigin": {
    badger.disablePrivacyBadgerForOrigin(request.domain);
    sendResponse({
      disabledSites: badger.getDisabledSites()
    });
    break;
  }

  case "enablePrivacyBadgerForOriginList": {
    request.domains.forEach(function (domain) {
      badger.enablePrivacyBadgerForOrigin(domain);
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
    badger.storage.getStore("snitch_map").deleteItem(request.origin);
    badger.storage.getStore("action_map").deleteItem(request.origin);
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  case "saveErrorText": {
    let activeTab = badger.tabData[request.tabId];
    activeTab.errorText = request.errorText;
    break;
  }

  case "removeErrorText": {
    let activeTab = badger.tabData[request.tabId];
    delete activeTab.errorText;
    break;
  }

  // called from contentscripts/dnt.js
  // to check if it should set DNT on Navigator
  case "checkDNT": {
    sendResponse(
      badger.isDNTSignalEnabled()
      && badger.isPrivacyBadgerEnabled(
        window.extractHostFromURL(sender.tab.url)
      )
    );
    break;
  }

  // called from contentscripts/floc.js
  // to check if we should disable document.interestCohort
  case "checkFloc": {
    sendResponse(badger.isFlocOverwriteEnabled());
    break;
  }

  // proxies surrogate script-initiated widget replacement messages
  // from one content script to another
  case "widgetFromSurrogate": {
    let tab_host = window.extractHostFromURL(sender.tab.url);
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

    let frameData = badger.getFrameData(sender.tab.id, sender.frameId);

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
    let frameData = badger.getFrameData(sender.tab.id, sender.frameId);
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
  chrome.webNavigation.onBeforeNavigate.addListener(onNavigate);

  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);

  chrome.webRequest.onBeforeRequest.addListener(filterWarRequests, {
    urls: chrome.runtime.getManifest().web_accessible_resources.map(
      path => chrome.runtime.getURL(path))
  }, ["blocking"]);

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

/************************************** exports */
let exports = {
  startListeners
};
return exports;
/************************************** exports */
})();
