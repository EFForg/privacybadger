/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2016 Electronic Frontier Foundation
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
import { getInitiatorUrl, guessTabIdFromInitiator } from "../lib/webrequestUtils.js";
import dnrUtils from "../lib/dnr/utils.js";

import { log } from "./bootstrap.js";
import constants from "./constants.js";
import incognito from "./incognito.js";
import surrogates from "./surrogates.js";
import utils from "./utils.js";

/**
 * Records where requests were seen and what should have happened to them
 * so that we can present this information in the browser popup.
 *
 * Initiates EFF's DNT policy checks for blocked domains.
 *
 * @param {Object} details webRequest request details object
 */
function onBeforeRequest(details) {
  if (!badger.INITIALIZED) {
    return;
  }

  let frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url,
    // is this a service worker-initiated request?
    sw_request = false,
    // did this request originate from the tab's current document?
    from_current_tab = true;

  if (type == "main_frame") {
    let oldTabData = badger.tabData.getFrameData(tab_id),
      is_reload = oldTabData && oldTabData.url == url,
      // TODO this doesn't work in Firefox when we reopen a closed tab
      // TODO https://bugzilla.mozilla.org/show_bug.cgi?id=1979084
      // TODO is_reload is probably similarly broken
      is_same_site_nav = oldTabData &&
        url.startsWith(`//${oldTabData.host}/`, url.indexOf('//'));
    forgetTab(tab_id, is_reload);
    badger.tabData.recordFrame(tab_id, frame_id, url);

    let tab_host = badger.tabData.getFrameData(tab_id).host;
    if (!is_same_site_nav) {
      if (oldTabData && oldTabData.host) {
        dnrUtils.updateSiteSpecificOverrideRules(tab_id, tab_host, oldTabData.host);
      } else {
        dnrUtils.updateSiteSpecificOverrideRules(tab_id, tab_host);
      }
    }
    initAllowedWidgets(tab_id, tab_host);

    return;
  }

  if (tab_id < 0) {
    // TODO may also want to apply this workaround in
    // TODO heuristicBlocking.checkForTrackingCookies()
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
    }
    // NOTE details.type is always xmlhttprequest for SW-initiated requests in Chrome,
    // which means surrogation won't work and frames won't get collapsed.
    // As a workaround, let's perform surrogation checks for all SW requests,
    // although we may redirect a non-script resource request to a matching surrogate.
    sw_request = true;
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

  let tab_host = frameData.host;

  let initiator_url = getInitiatorUrl(frameData.url, details);
  if (initiator_url) {
    // if we are no longer on the page the request originated from,
    // don't log in popup or attempt to replace widgets
    // but do block request/modify headers
    from_current_tab = false;
    tab_host = extractHostFromURL(initiator_url);
  }

  if (type == "sub_frame" && from_current_tab) {
    badger.tabData.recordFrame(tab_id, frame_id, url);
  }

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    return;
  }

  // TODO !from_current_tab requests shouldn't go through allowedOnTab()
  let action = checkAction(tab_id, tab_host, request_host, frame_id);
  if (!action) {
    return;
  }

  if (from_current_tab) {
    badger.logThirdParty(tab_id, request_host, action);
  }

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return;
  }

  // note when we should have blocked requests to known fingerprinter scripts
  // hosted by (user)cookieblocked CDNs
  if (type == 'script' || sw_request) {
    if (action == constants.COOKIEBLOCK || action == constants.USER_COOKIEBLOCK) {
      if (constants.FP_CDN_DOMAINS.has(request_host)) {
        let fpScripts = badger.storage.getStore('fp_scripts').getItem(request_host);

        if (fpScripts) {
          let script_path = url.slice(url.indexOf(request_host) + request_host.length),
            qs_start = script_path.indexOf('?');
          if (qs_start != -1) {
            script_path = script_path.slice(0, qs_start);
          }
          if (utils.hasOwn(fpScripts, script_path)) {
            if (from_current_tab) {
              badger.tabData.logFpScript(tab_id, request_host, url);
            }

            return;
          }
        }
      }
    }
  }

  if (action != constants.BLOCK && action != constants.USER_BLOCK) {
    return;
  }

  if ((type == 'script' || sw_request) && from_current_tab) {
    let surrogate;

    if (utils.hasOwn(surrogates.WIDGET_SURROGATES, request_host)) {
      let prefs = badger.getSettings();
      if (!prefs.getItem('widgetReplacementExceptions').includes(surrogates.WIDGET_SURROGATES[request_host].widgetName)) {
        surrogate = surrogates.getSurrogateUri(url, request_host);
      }
    } else {
      surrogate = surrogates.getSurrogateUri(url, request_host);
    }

    if (surrogate) {
      return;
    }
  }

  // notify the widget replacement content script
  if (from_current_tab) {
    chrome.tabs.sendMessage(tab_id, {
      type: "replaceWidget",
      trackerDomain: request_host,
      frameId: (type == 'sub_frame' ? details.parentFrameId : frame_id)
    }).catch(function () {
      // ignore "Could not establish connection. Receiving end does not exist."
      // socialwidgets.js is injected on document_idle; we don't care about
      // it missing these messages since it will handle all previously-seen
      // widgets once it is ready
    });
  }

  // if this is a heuristically- (not user-) blocked domain
  if (action == constants.BLOCK && incognito.learningEnabled(tab_id)) {
    // check for DNT policy asynchronously
    setTimeout(function () {
      badger.checkForDNTPolicy(request_host);
    }, 0);
  }
}

/**
 * Event handler when a tab gets removed
 *
 * @param {Integer} tab_id ID of the tab
 */
function onTabRemoved(tab_id) {
  setTimeout(function () {
    forgetTab(tab_id);
    dnrUtils.removeTabSessionRules(tab_id);
  }, utils.oneSecond() * 20);
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

  // initialize tab data bookkeeping used by heuristicBlocking.checkForTrackingCookies()
  // to avoid missing or misattributing learning
  // when there is no "main_frame" webRequest callback
  // (such as on Service Worker pages)
  //
  // see the tabBases TODO in heuristicblocking.js
  // as to why we don't just use tabData
  let base = getBaseDomain(tab_host);
  badger.heuristicBlocking.tabBases[tab_id] = base;
  badger.heuristicBlocking.tabUrls[tab_id] = url;
}

/**
 * Record "supercookie" tracking
 *
 * @param {Integer} tab_id browser tab ID
 * @param {String} frame_host hostname of the frame with supercookie
 */
function recordSupercookie(tab_id, frame_host) {
  const page_host = badger.tabData.getFrameData(tab_id).host;

  badger.heuristicBlocking.updateTrackerPrevalence(
    frame_host,
    getBaseDomain(frame_host),
    getBaseDomain(page_host)
  );

  // log for popup
  let action = checkAction(tab_id, page_host, frame_host);
  if (action) {
    badger.logThirdParty(tab_id, frame_host, action);
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
    return;
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
          let action = checkAction(tab_id, document_host, script_host);
          if (action) {
            badger.logThirdParty(tab_id, script_host, action);
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
 * @param {Boolean} is_reload whether the page is being reloaded
 */
function forgetTab(tab_id, is_reload) {
  badger.tabData.forget(tab_id, is_reload);
}

/**
 * Determines the action to take on a specific FQDN.
 *
 * @param {Integer} tab_id
 * @param {String} tab_host
 * @param {String} request_host
 * @param {Integer} [frame_id]
 *
 * @returns {(String|Boolean)} the action constant or false (ignore)
 */
function checkAction(tab_id, tab_host, request_host, frame_id) {
  // Ignore requests from temporarily unblocked widgets.
  // Someone clicked the widget, so let it load.
  if (allowedOnTab(tab_id, request_host, frame_id)) {
    return false;
  }

  // Ignore requests from private domains.
  if (isPrivateDomain(request_host)) {
    return false;
  }

  // apply site-specific "ignore" overrides, if any
  let sitefixes = badger.getPrivateSettings().getItem('sitefixes');
  if (utils.hasOwn(sitefixes, tab_host)) {
    if (utils.hasOwn(sitefixes[tab_host], 'ignore')) {
      for (let pattern of sitefixes[tab_host].ignore) {
        if (pattern === request_host || request_host.endsWith('.' + pattern)) {
          return false;
        }
      }
    }
  }

  let action = badger.storage.getBestAction(request_host);

  // if this isn't a user-set action,
  // apply site-specific "cookieblock" overrides, if any
  if (utils.hasOwn(sitefixes, tab_host) && !constants.USER_ACTIONS.has(action)) {
    if (utils.hasOwn(sitefixes[tab_host], 'yellowlist')) {
      for (let pattern of sitefixes[tab_host].yellowlist) {
        if (pattern === request_host || request_host.endsWith('.' + pattern)) {
          return constants.COOKIEBLOCK;
        }
      }
    }
  }

  return action;
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
        UI_LOCALE = chrome.i18n.getMessage('@@ui_locale').replace('-', '_');
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
      if (utils.hasOwn(badger.tabData.tempAllowedWidgets, tab_id) &&
          badger.tabData.tempAllowedWidgets[tab_id].includes(widget.name)) {
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
  if (!utils.hasOwn(badger.tabData.tempAllowlist, tab_id)) {
    return false;
  }

  let exceptions = badger.tabData.tempAllowlist[tab_id];

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
 * Called upon navigation to prepopulate the temporary allowlist
 * with domains for widgets marked as always allowed on a given site.
 */
function initAllowedWidgets(tab_id, tab_host) {
  let allowedWidgets = badger.getSettings().getItem('widgetSiteAllowlist');
  if (utils.hasOwn(allowedWidgets, tab_host)) {
    for (let widget_name of allowedWidgets[tab_host]) {
      let widgetDomains = getWidgetDomains(widget_name);
      if (widgetDomains) {
        badger.tabData.allowOnTab(tab_id, widgetDomains, widget_name);
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
      scriptSelectors: [`script[src='${utils.cssEscape(script_url)}']`],
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
      scriptSelectors: [`script[src='${utils.cssEscape(script_url)}']`],
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
        `script[src^='${utils.cssEscape("https://www.youtube.com/iframe_api")}']`,
        `script[src^='${utils.cssEscape("https://www.youtube.com/player_api")}']`
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
  // messages may arrive before Privacy Badger is ready
  // for example, user clicks to open the popup when the ephemeral background
  // process is not running; the getPopupData message from the popup causes
  // the background to start but the background is not yet ready to respond
  if (!badger.INITIALIZED) {
    if ((Date.now() - badger.startTime) > 15000) {
      // too much time elapsed for this to be a normal initialization,
      // give up to avoid an infinite loop
      badger.criticalError = "Privacy Badger failed to initialize";
      // update badge
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs[0]) {
          badger.updateBadge(tabs[0].id);
        }
      });
      // show error in popup
      if (request.type == "getPopupData") {
        return sendResponse({
          criticalError: badger.criticalError,
          isAndroid: badger.isAndroid,
          noTabData: true,
          settings: { seenComic: true },
        });
      }
      return sendResponse();
    } else {
      setTimeout(function () {
        dispatcher(request, sender, sendResponse);
      }, 50);
      // indicate this is an async response to chrome.runtime.onMessage
      return true;
    }
  }

  // messages from content scripts are to be treated with greater caution:
  // https://groups.google.com/a/chromium.org/g/chromium-extensions/c/0ei-UCHNm34/m/lDaXwQhzBAAJ
  //
  // use sender.origin, not sender.url:
  // https://issues.chromium.org/issues/40095810
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1787379
  // https://github.com/uBlockOrigin/uBlock-issues/issues/1992#issuecomment-1058056302
  if (sender.origin == "null" || sender.origin + '/' !== chrome.runtime.getURL('')) {
    // reject unless it's a known content script message
    const KNOWN_CONTENT_SCRIPT_MESSAGES = [
      "allowWidgetOnSite",
      "checkClobberingEnabled",
      "checkEnabled",
      "checkWidgetReplacementEnabled",
      "detectFingerprinting",
      "detectSupercookies",
      "fpReport",
      "getReplacementButton",
      "reloadWidgetScripts",
      "supercookieReport",
      "unblockWidget",
      "widgetFromSurrogate",
      "widgetReplacementReady",
    ];
    if (KNOWN_CONTENT_SCRIPT_MESSAGES.includes(request.type)) {
      if (!sender.tab) {
        console.error("Dropping malformed content script message %o from %o",
          request, sender);
        return sendResponse();
      }
    } else {
      console.error("Rejected unknown message %o from %o", request, sender);
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

  case "checkClobberingEnabled": {
    if (sender.origin == "null") {
      return sendResponse();
    }

    let tab_host = extractHostFromURL(sender.tab.url);

    if (!badger.isPrivacyBadgerEnabled(tab_host)) {
      return sendResponse();
    }

    let frame_host = extractHostFromURL(sender.origin + '/');

    // CNAME uncloaking
    if (utils.hasOwn(badger.cnameDomains, frame_host)) {
      frame_host = badger.cnameDomains[frame_host];
    }

    // Ignore requests that aren't from a third party.
    if (!frame_host || !utils.isThirdPartyDomain(frame_host, tab_host)) {
      return sendResponse();
    }

    let action = checkAction(sender.tab.id, tab_host, frame_host);
    if (action == constants.COOKIEBLOCK || action == constants.USER_COOKIEBLOCK) {
      chrome.scripting.executeScript({
        target: {
          tabId: sender.tab.id,
          frameIds: [sender.frameId]
        },
        injectImmediately: true,
        world: chrome.scripting.ExecutionWorld.MAIN,
        files: ["js/contentscripts/clobbercookie.js",
          "js/contentscripts/clobberlocalstorage.js"],
      }).catch(function () {
        // ignore "Frame with ID [NUM] was removed."
      });
    }

    sendResponse();
    break;
  }

  case "unblockWidget": {
    let widgetDomains = getWidgetDomains(request.widgetName);
    if (!widgetDomains) {
      return sendResponse();
    }

    badger.tabData.allowOnTab(sender.tab.id, widgetDomains, request.widgetName);

    dnrUtils.updateSessionAllowRules(badger.tabData.tempAllowlist);

    let _checkRules = function () {
      chrome.declarativeNetRequest.getSessionRules(rules => {
        let found_all = widgetDomains.every(d => {
          return rules.find(r => {
            if (r.priority == constants.DNR_WIDGET_ALLOW_ALL) {
              if (r.condition.tabIds.includes(sender.tab.id)) {
                if (r.condition.requestDomains) {
                  return r.condition.requestDomains.includes(d);
                } else if (r.condition.urlFilter) {
                  return r.condition.urlFilter == "||" + d.slice(2);
                }
              }
            }
            return false;
          });
        });
        if (found_all) {
          return sendResponse();
        }
        setTimeout(_checkRules, 50);
      });
    };

    // poll for DNR to get updated
    _checkRules();

    return true; // async chrome.runtime.onMessage response
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

  case "reloadWidgetScripts": {
    if (request.selectors) {
      chrome.scripting.executeScript({
        target: {
          tabId: sender.tab.id,
          frameIds: [sender.frameId]
        },
        injectImmediately: true,
        world: chrome.scripting.ExecutionWorld.MAIN,
        /**
         * Find and replace script elements with their copies to trigger re-running.
         *
         * This is code for re-activating a previously blocked third-party widget
         * (such as Google reCAPTCHA or Disqus comments).
         *
         * The scripts being run are third-party widget scripts that Privacy Badger
         * previously blocked and the user chose to activate.
         *
         * For example:
         *
         * 1. The user visits a page with comments powered by Disqus.
         * 2. Privacy Badger blocks the Disqus script and inserts a placeholder
         * where the Disqus widget would have appeared.
         * 3. If the user chooses to click "Allow" in the placeholder, Privacy Badger
         * removes the placeholder and reinserts the Disqus script.
         *
         * Any script reinserted here is a script that would have
         * run on the page anyway, had Privacy Badger not blocked it.
         */
        func: function (selectors) {
          // eslint-disable-next-line no-undef
          let scripts = document.querySelectorAll(selectors.join(','));

          for (let scriptEl of scripts) {
            // reinsert script elements only
            if (!scriptEl.nodeName || scriptEl.nodeName.toLowerCase() != 'script') {
              continue;
            }

            // eslint-disable-next-line no-undef
            let replacement = document.createElement("script");
            for (let attr of scriptEl.attributes) {
              replacement.setAttribute(attr.nodeName, attr.value);
            }
            scriptEl.parentNode.replaceChild(replacement, scriptEl);
            // reinsert one script and quit
            break;
          }
        },
        args: [request.selectors],
      });
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
    if (badger.hasSupercookie(request.data)) {
      let frame_host = extractHostFromURL(sender.origin + '/');
      recordSupercookie(sender.tab.id, frame_host);
    }
    break;
  }

  case "detectSupercookies": {
    if (sender.origin == "null") {
      return sendResponse();
    }

    let tab_host = extractHostFromURL(sender.tab.url),
      frame_host = extractHostFromURL(sender.origin + '/');

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
    if (sender.frameId > 0) {
      // do not modify the JS environment in Cloudflare CAPTCHA frames
      if (sender.origin === "https://challenges.cloudflare.com") {
        sendResponse(false);
        break;
      }
    }

    sendResponse(badger.isLearningEnabled(sender.tab.id) &&
      badger.isPrivacyBadgerEnabled(extractHostFromURL(sender.tab.url)));

    break;
  }

  case "checkWidgetReplacementEnabled": {
    let response = false,
      tab_host = extractHostFromURL(sender.tab.url);

    if (badger.isPrivacyBadgerEnabled(tab_host)) {
      response = getWidgetList(sender.tab.id);
      response.frameId = sender.frameId;
    }

    sendResponse(response);

    break;
  }

  case "getPopupData": {
    let tab_id = request.tabId;

    // if tab data isn't yet ready, retry up to a point
    if (!badger.tabData.INITIALIZED && (Date.now() - badger.startTime) < 5000) {
      setTimeout(function () {
        dispatcher(request, sender, sendResponse);
      }, 50);
      return true; // async chrome.runtime.onMessage response
    }

    if (!badger.tabData.has(tab_id)) {
      sendResponse({
        criticalError: badger.criticalError,
        isAndroid: badger.isAndroid,
        noTabData: true,
        settings: { seenComic: true },
      });
      break;
    }

    let tab_host = extractHostFromURL(request.tabUrl),
      trackers = badger.tabData.getTrackers(tab_id),
      sitefixes = badger.getPrivateSettings().getItem("sitefixes")[tab_host],
      siteYellowlist = sitefixes && sitefixes.yellowlist,
      cookieblocked = {};

    for (let fqdn in trackers) {
      // see if FQDN would be cookieblocked if not for user override
      if (badger.storage.wouldGetCookieblocked(fqdn)) {
        cookieblocked[fqdn] = true;
        continue;
      }
      // also account for site-specific overrides
      if (siteYellowlist) {
        for (let pattern of siteYellowlist) {
          if (pattern === fqdn || fqdn.endsWith('.' + pattern)) {
            cookieblocked[fqdn] = true;
          }
        }
      }
    }

    sendResponse({
      blockedFpScripts: badger.tabData._tabData[tab_id].blockedFpScripts,
      cookieblocked,
      criticalError: badger.criticalError,
      enabled: badger.isPrivacyBadgerEnabled(tab_host),
      errorText: badger.tabData._tabData[tab_id].errorText,
      isAndroid: badger.isAndroid,
      isOnFirstParty: utils.firstPartyProtectionsEnabled(tab_host),
      noTabData: false,
      trackers,
      settings: badger.getSettings().getItemClones(),
      showLearningPrompt: badger.getPrivateSettings().getItem("showLearningPrompt"),
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
      // see if FQDN would be cookieblocked if not for user override
      if (badger.storage.wouldGetCookieblocked(fqdn)) {
        cookieblocked[fqdn] = true;
      }
    }

    sendResponse({
      cookieblocked,
      isAndroid: badger.isAndroid,
      trackers,
      settings: badger.getSettings().getItemClones(),
      widgets: badger.widgetList.map(widget => widget.name),
      widgetDomains: Array.from(badger.getAllWidgetDomains()),
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
    badger.storage.clearTrackerData().then(function () {
      badger.loadSeedData().then(function () {
        globalThis.DATA_LOAD_IN_PROGRESS = true;
        badger.blockWidgetDomains();
        badger.blockPanopticlickDomains();
        globalThis.DATA_LOAD_IN_PROGRESS = false;
        sendResponse();
      }).catch(function (err) {
        console.error(err);
        sendResponse();
      });
    });
    return true; // async chrome.runtime.onMessage response
  }

  case "removeAllData": {
    badger.storage.clearTrackerData().then(sendResponse);
    return true; // async chrome.runtime.onMessage response
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
    globalThis.SURROGATES_DISABLED = true;
    sendResponse();
    break;
  }

  // used by tests
  case "restoreSurrogates": {
    delete globalThis.SURROGATES_DISABLED;
    sendResponse();
    break;
  }

  // used by tests
  case "addSiteOverride": {
    let sitefixes = badger.getPrivateSettings().getItem('sitefixes');
    sitefixes[request.site_domain] = {
      yellowlist: [ request.domain ]
    };
    badger.getPrivateSettings().setItem('sitefixes', sitefixes);
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

  // used by Badger Sett
  case "setIgnoredSiteBases": {
    if (request.value && Array.isArray(request.value)) {
      badger.getPrivateSettings().setItem("ignoredSiteBases", request.value);
    }
    sendResponse();
    break;
  }

  case "seenLearningPrompt": {
    badger.getPrivateSettings().setItem("showLearningPrompt", false);
    sendResponse();
    break;
  }

  case "reenableOnSiteFromPopup": {
    let _checkRules = function () {
      chrome.declarativeNetRequest.getDynamicRules(rules => {
        let found = rules.find(r =>
          r.action.type == 'allowAllRequests' &&
            r.priority == constants.DNR_SITE_ALLOW_ALL &&
            r.condition.requestDomains.includes(request.tabHost));
        if (!found) {
          badger.updateIcon(request.tabId, request.tabUrl);
          return sendResponse();
        }
        setTimeout(_checkRules, 50);
      });
    };

    badger.reenableOnSite(request.tabHost);

    // poll for DNR to get updated
    _checkRules();

    return true; // async chrome.runtime.onMessage response
  }

  case "disableOnSiteFromPopup": {
    let _checkRules = function () {
      chrome.declarativeNetRequest.getDynamicRules(rules => {
        let found = rules.find(r =>
          r.action.type == 'allowAllRequests' &&
            r.priority == constants.DNR_SITE_ALLOW_ALL &&
            r.condition.requestDomains.includes(request.tabHost));
        if (found) {
          badger.updateIcon(request.tabId, request.tabUrl);
          return sendResponse();
        }
        setTimeout(_checkRules, 50);
      });
    };

    badger.disableOnSite(request.tabHost);

    // poll for DNR to get updated
    _checkRules();

    return true; // async chrome.runtime.onMessage response
  }

  case "revertDomainControl": {
    let _checkRules = function () {
      chrome.declarativeNetRequest.getDynamicRules(rules => {
        let found = rules.some(r =>
          constants.DNR_USER_ACTIONS.has(r.priority) &&
            r.condition.requestDomains[0] == request.domain);
        if (!found) {
          return sendResponse({
            trackers: badger.storage.getTrackingDomains()
          });
        }
        setTimeout(_checkRules, 50);
      });
    };

    badger.storage.revertUserAction(request.domain);

    // poll for DNR to get updated
    _checkRules();

    return true; // async chrome.runtime.onMessage response
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
    let domain = request.domain,
      action = request.action;

    badger.saveAction(action, domain);

    // update cached tab data so that a reopened popup displays correct state
    badger.tabData.logTracker(request.tabId, domain, "user_" + action);

    break;
  }

  // called when the user manually sets a slider on the options page
  case "saveOptionsToggle": {
    badger.saveAction(request.action, request.domain);
    sendResponse({
      trackers: badger.storage.getTrackingDomains()
    });
    break;
  }

  // used by Badger Sett
  case "mergeData": {
    badger.storage.mergeUserData(request.data);
    sendResponse();
    break;
  }

  // called when a user imports data exported from another Badger instance
  case "mergeUserData": {
    badger.storage.mergeUserData(request.data);
    badger.blockWidgetDomains();
    badger.setPrivacyOverrides();
    badger.initDeprecations();
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

  case "removeDomain": {
    for (let name of ['snitch_map', 'action_map', 'tracking_map', 'fp_scripts']) {
      badger.storage.getStore(name).deleteItem(request.domain);
    }
    sendResponse({
      trackers: badger.storage.getTrackingDomains()
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

  // proxies surrogate script-initiated widget replacement messages
  // from one content script to another
  case "widgetFromSurrogate": {
    let tab_url = sender.tab.url,
      tab_host = extractHostFromURL(tab_url);
    if (!badger.isPrivacyBadgerEnabled(tab_host)) {
      break;
    }

    // accept widget surrogate messages only from top-level,
    // first-party, and Embedly frames
    //
    // NOTE: before removing this restriction, investigate
    // implications of accepting pbSurrogateMessage events
    // from third-party scripts in nested frames
    if (sender.frameId > 0) {
      let frame_origin = sender.origin != "null" && sender.origin;

      if (!frame_origin) {
        break;
      }

      if (frame_origin !== "https://cdn.embedly.com") {
        let tab_scheme = tab_url.slice(0, tab_url.indexOf(tab_host));
        if (frame_origin !== tab_scheme + tab_host) {
          let frame_host = extractHostFromURL(frame_origin + '/');
          if (utils.isThirdPartyDomain(frame_host, tab_host)) {
            break;
          }
        }
      }
    }

    if (request.name == "X (Twitter)") {
      // no need to build a custom widget,
      // merely rescan the page for Twitter embeds
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "replaceWidget",
        trackerDomain: "platform.twitter.com",
        frameId: sender.frameId
      });
      break;
    }

    // NOTE: request.name and request.data are not to be trusted
    // https://github.com/w3c/webextensions/issues/57#issuecomment-914491167
    // https://github.com/w3c/webextensions/issues/78#issuecomment-921058071
    // TODO request.frameUrl could be undefined or tampered with
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

function startListeners() {
  chrome.webNavigation.onCommitted.addListener(onNavigate);

  chrome.tabs.onRemoved.addListener(onTabRemoved);
  chrome.tabs.onReplaced.addListener(onTabReplaced);
  chrome.runtime.onMessage.addListener(dispatcher);

  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]});
}

export default {
  startListeners
};
