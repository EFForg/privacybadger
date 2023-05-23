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

export {
  guessTabIdFromInitiator,
};
