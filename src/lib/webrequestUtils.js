/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2023 Electronic Frontier Foundation
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

import utils from "../js/utils.js";

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
 * Looks up the top-level document URL for a given request/response
 * from metadata on the request/response object.
 *
 * Returns null if we already appear to have the correct document URL,
 * or if the metadata is unavailable for whatever reason.
 *
 * @param {String} tab_url our guess for the top-level document URL
 * @param {Object} details webRequest request/response details object
 *
 * @returns {?String} the top-level document URL or null
 */
function getInitiatorUrl(tab_url, details) {
  // Firefox 58+
  if (utils.hasOwn(details, "documentUrl") && utils.hasOwn(details, "frameAncestors")) {
    let url;

    if (details.frameAncestors.length) {
      // inside a frame
      url = details.frameAncestors[details.frameAncestors.length - 1].url;
    } else {
      // inside the top-level document
      url = details.documentUrl;
    }

    if (url == tab_url) {
      // already have the correct hostname
      return null;
    }

    return url;
  }

  // Chrome 63+
  if (utils.hasOwn(details, "initiator")) {
    if (details.initiator && details.initiator != "null") {
      // can only rely on initiator for main frame resources:
      // https://crbug.com/838242#c17
      if (details.parentFrameId == -1 || (details.type == "sub_frame" && details.parentFrameId === 0)) {
        // note that "initiator" does not give us the complete document URL
        if (!tab_url.startsWith(details.initiator)) {
          return details.initiator + '/';
        }
      }
    }

    return null;
  }

  return null;
}

export {
  getInitiatorUrl,
  guessTabIdFromInitiator,
};
