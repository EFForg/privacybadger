/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2014 Electronic Frontier Foundation
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

import { extractHostFromURL } from "../lib/basedomain.js";

import utils from "./utils.js";

function TabData() {
  let self = this;

  /**
   * {
   *   <tab_id>: {
   *     blockedFpScripts: {
   *       <script_fqdn>: {String} script URL,
   *       ...
   *     },
   *     blockedFrameUrls: {
   *       <parent_frame_id>: [
   *         {String} blocked frame URL,
   *         ...
   *       ],
   *       ...
   *     },
   *     fpData: {
   *       <script_base>: {
   *         canvas: {
   *           fingerprinting: {Boolean},
   *           write: {Boolean}
   *         }
   *       },
   *       ...
   *     },
   *     frames: {
   *       <frame_id>: {
   *         url: {?String}
   *         host: {?String}
   *         widgetReplacementReady: {Boolean}
   *         widgetQueue: {Array} widget objects
   *         warAccessTokens: {
   *           <extension_resource_URL>: {String} access token
   *           ...
   *         }
   *       },
   *       ...
   *     },
   *     trackers: {
   *       <third_party_fqdn>: {String} action taken for this domain
   *       ...
   *     }
   *   },
   *   ...
   * }
   */
  self._tabData = {};

  /**
   * Mapping of Chrome webRequest details.initiator URLs to tab IDs.
   *
   * tabIdsByInitiator = {
   *   <url>: {Integer} tab ID,
   *   ...
   * }
   */
  self.tabIdsByInitiator = {};
}

/**
 * Populates tabData with currently open tabs on Privacy Badger startup.
 *
 * @returns {Promise}
 */
TabData.prototype.initialize = function () {
  let self = this;

  return new Promise(function (resolve) {
    chrome.tabs.query({}, tabs => {
      for (let tab of tabs) {
        // don't record on special browser pages
        if (!utils.isRestrictedUrl(tab.url)) {
          self.recordFrame(tab.id, 0, tab.url);
        }
      }
      resolve();
    });
  });
};

/**
 * Returns whether tabData is populated for a given tab ID.
 *
 * @param {Integer} tab_id ID of the tab
 *
 * @returns {Boolean}
 */
TabData.prototype.has = function (tab_id) {
  return utils.hasOwn(this._tabData, tab_id);
};

/**
 * Removes all per-tab data (such as on tab closing).
 *
 * @param {Integer} tab_id ID of the tab
 */
TabData.prototype.forget = function (tab_id) {
  let self = this;

  delete self._tabData[tab_id];

  for (let initiator in self.tabIdsByInitiator) {
    if (self.tabIdsByInitiator[initiator] == tab_id) {
      delete self.tabIdsByInitiator[initiator];
      break;
    }
  }
};

/**
 * Records frame data. Top-level documents have frame_id === 0.
 *
 * @param {Integer} tab_id ID of the tab
 * @param {Integer} frame_id ID of the frame
 * @param {?String} frame_url The URL of the frame
 */
TabData.prototype.recordFrame = function (tab_id, frame_id, frame_url) {
  let self = this;

  if (!self.has(tab_id)) {
    self._tabData[tab_id] = {
      blockedFpScripts: {},
      blockedFrameUrls: {},
      fpData: {},
      frames: {},
      trackers: {},
    };
  }

  self._tabData[tab_id].frames[frame_id] = {
    url: frame_url,
    host: (frame_url ? extractHostFromURL(frame_url) : null)
  };

  if (frame_id === 0 && frame_url) {
    let initiator = (new URL('/', frame_url)).toString().slice(0, -1);
    self.tabIdsByInitiator[initiator] = tab_id;
  }
};

/**
 * Returns previously recorded frame data.
 *
 * @param {Integer} tab_id Tab ID to check for
 * @param {Integer} [frame_id=0] Frame ID to check for.
 *  Optional, defaults to frame 0 (the main document frame).
 *
 * @returns {?Object} Frame data object or null
 */
TabData.prototype.getFrameData = function (tab_id, frame_id) {
  let self = this;

  frame_id = frame_id || 0;

  if (self.has(tab_id)) {
    if (utils.hasOwn(self._tabData[tab_id].frames, frame_id)) {
      return self._tabData[tab_id].frames[frame_id];
    }
  }

  return null;
};

/**
 * Returns a mapping between tracker FQDNs
 * and Privacy Badger actions for the given tab.
 *
 * @param {Integer} tab_id ID of the tab
 *
 * @returns {Object} tabData.trackers object or {}
 */
TabData.prototype.getTrackers = function (tab_id) {
  let self = this;

  if (self.has(tab_id)) {
    return self._tabData[tab_id].trackers;
  }

  return {};
};

/**
 * Records performing an action for a tracker FQDN on a tab.
 *
 * @param {Integer} tab_id ID of the tab
 * @param {String} fqdn the tracker domain
 * @param {String} action the action taken
 */
TabData.prototype.logTracker = function (tab_id, fqdn, action) {
  let self = this;

  if (!self.has(tab_id)) {
    console.error("logTracker(%s, %s, %s): uninitialized tabData", tab_id, fqdn, action);
    return;
  }

  self._tabData[tab_id].trackers[fqdn] = action;
};

/**
 * Records blocking a previously detected fingerprinting script.
 *
 * @param {Integer} tab_id the ID of the tab
 * @param {String} fqdn the script's domain
 * @param {String} url the full URL of the script
 */
TabData.prototype.logFpScript = function (tab_id, fqdn, url) {
  let self = this;

  if (!self.has(tab_id)) {
    console.error("logFpScript(%s, %s, %s): uninitialized tabData", tab_id, fqdn, url);
    return;
  }

  if (!utils.hasOwn(self._tabData[tab_id].blockedFpScripts, fqdn)) {
    self._tabData[tab_id].blockedFpScripts[fqdn] = [];
  }

  self._tabData[tab_id].blockedFpScripts[fqdn].push(url);
};

/**
 * Returns the fpData entry for a script's base domain.
 * Initializes the entry if it doesn't exist.
 * Assumes tab data is initialized for the tab.
 *
 * @param {Integer} tab_id ID of the tab
 * @param {String} script_base the base domain of the script
 *
 * @returns {Object}
 */
TabData.prototype.getScriptData = function (tab_id, script_base) {
  let self = this;

  // initialize script TLD-level data
  if (!utils.hasOwn(self._tabData[tab_id].fpData, script_base)) {
    self._tabData[tab_id].fpData[script_base] = {
      canvas: {
        fingerprinting: false,
        write: false
      }
    };
  }

  return self._tabData[tab_id].fpData[script_base];
};

/**
 * Records that a canvas write was performed by a potential script tracker.
 * Assumes tab data is initialized for the tab.
 *
 * @param {Integer} tab_id ID of the tab
 * @param {String} script_base the base domain of the script
 */
TabData.prototype.logCanvasWrite = function (tab_id, script_base) {
  let self = this,
    scriptData = self.getScriptData(tab_id, script_base);

  scriptData.canvas.write = true;
};

/**
 * Records that a script was seen performing canvas fingerprinting.
 * Assumes tab data is initialized for the tab.
 *
 * @param {Integer} tab_id ID of the tab
 * @param {String} script_base the base domain of the script
 */
TabData.prototype.logCanvasFingerprinting = function (tab_id, script_base) {
  let self = this,
    scriptData = self.getScriptData(tab_id, script_base);

  scriptData.canvas.fingerprinting = true;
};

export default TabData;
