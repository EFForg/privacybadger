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

import { extractHostFromURL, getChromeInitiator } from "../lib/basedomain.js";

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

  /**
   * Mapping of (widget) domains to tab IDs.
   * Used to look up all widget domains that have been activated on a given tab.
   *
   * tempAllowlist = {
   *   <tab_id>: [
   *     {String} domain,
   *     ...
   *   ],
   *   ...
   * }
   */
  self.tempAllowlist = {};
  /**
   * Mapping of widget names to tab IDs.
   * Used to look up all widget names that have been activated on a given tab.
   *
   * tempAllowedWidgets = {
   *   <tab_id>: [
   *     {String} widget name,
   *     ...
   *   ],
   *   ...
   * }
   */
  self.tempAllowedWidgets = {};
}

/**
 * Populates tabData with currently open tabs on Privacy Badger startup.
 *
 * @returns {Promise}
 */
TabData.prototype.initialize = function () {
  let self = this;

  return new Promise(function (resolve) {
    self.restoreSession(function (savedData) {
      let oldTabData = savedData && savedData.tabData;

      chrome.tabs.query({}, tabs => {
        for (let tab of tabs) {
          // don't record on special browser pages
          if (utils.isRestrictedUrl(tab.url)) {
            continue;
          }

          // if there is data in session storage, restore
          if (oldTabData && utils.hasOwn(oldTabData, tab.id) &&
            oldTabData[tab.id].frames[0] && (tab.url == oldTabData[tab.id].frames[0].url)) {

            self.set(tab.id, oldTabData[tab.id]);

            self.tabIdsByInitiator[getChromeInitiator(tab.url)] = tab.id;

            if (savedData.tempAllowlist) {
              if (utils.hasOwn(savedData.tempAllowlist, tab.id)) {
                self.tempAllowlist[tab.id] = [...savedData.tempAllowlist[tab.id]];
              }
            }
            if (savedData.tempAllowedWidgets) {
              if (utils.hasOwn(savedData.tempAllowedWidgets, tab.id)) {
                self.tempAllowedWidgets[tab.id] = [...savedData.tempAllowedWidgets[tab.id]];
              }
            }

            continue;
          }

          // no data to restore, make a new tab data entry
          // TODO indicate that we don't have complete info for this tab?
          self.recordFrame(tab.id, 0, tab.url);
        }

        resolve();
      });
    });
  });
};

/**
 * Restores tab data from session storage.
 *
 * @param {Function} callback
 */
TabData.prototype.restoreSession = function (callback) {
  if (!chrome.storage.session) {
    return callback({});
  }

  const SESSION_STORAGE_KEYS = [
    'tabData',
    'tempAllowlist',
    'tempAllowedWidgets',
  ];

  chrome.storage.session.get(SESSION_STORAGE_KEYS, function (res) {
    if (utils.isObject(res) && Object.keys(res).length) {
      // clean up
      chrome.storage.session.remove(SESSION_STORAGE_KEYS, function () {
        callback(res);
      });
    } else {
      callback({});
    }
  });
};

/**
 * Saves tab data to session storage.
 */
TabData.prototype.saveSession = (function () {
  // persist to session storage at most once every second
  let _save = utils.debounce(function () {
    chrome.storage.session.set({
      tabData: this._tabData,
      tempAllowlist: this.tempAllowlist,
      tempAllowedWidgets: this.tempAllowedWidgets,
    });
  }, 1000);

  // noop if no session storage
  if (!chrome.storage.session) {
    return function () {};
  }
  // also noop if not MV3 and persistent is not set to false
  let manifestJson = chrome.runtime.getManifest();
  if (manifestJson.manifest_version == 2) {
    if (!utils.hasOwn(manifestJson.background, "persistent") || manifestJson.background.persistent !== false) {
      return function () {};
    }
  }

  return function () {
    _save.bind(this)();
  };
}());

/**
 * Overwrites all data for a tab, triggering a save to session storage.
 *
 * @param {Integer} tab_id ID of the tab
 * @param {Object} data the tab data
 */
TabData.prototype.set = function (tab_id, data) {
  this._tabData[tab_id] = JSON.parse(JSON.stringify(data));
  this.saveSession();
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
 * @param {Boolean} [keep_temp_allowlists=false]
 */
TabData.prototype.forget = function (tab_id, keep_temp_allowlists) {
  let self = this;

  delete self._tabData[tab_id];

  if (!keep_temp_allowlists) {
    delete self.tempAllowlist[tab_id];
    delete self.tempAllowedWidgets[tab_id];
  }

  for (let initiator in self.tabIdsByInitiator) {
    if (self.tabIdsByInitiator[initiator] == tab_id) {
      delete self.tabIdsByInitiator[initiator];
      break;
    }
  }

  self.saveSession();
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
    self.tabIdsByInitiator[getChromeInitiator(frame_url)] = tab_id;
  }

  self.saveSession();
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
  let self = this,
    changed = false;

  if (!self.has(tab_id)) {
    console.error("logTracker(%s, %s, %s): uninitialized tabData", tab_id, fqdn, action);
    return;
  }

  if (!utils.hasOwn(self._tabData[tab_id].trackers, fqdn) ||
    self._tabData[tab_id].trackers[fqdn] != action) {
    changed = true;
  }

  self._tabData[tab_id].trackers[fqdn] = action;

  if (changed) {
    self.saveSession();
  }
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

  self.saveSession();
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
  self.saveSession();
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
  self.saveSession();
};

/**
 * Marks a set of (widget) domains to be (temporarily) allowed on a tab.
 *
 * @param {Integer} tab_id the ID of the tab
 * @param {Array} domains the domains
 * @param {String} widget_name the name (ID) of the widget
 */
TabData.prototype.allowOnTab = function (tab_id, domains, widget_name) {
  let self = this;

  if (!utils.hasOwn(self.tempAllowlist, tab_id)) {
    self.tempAllowlist[tab_id] = [];
  }
  for (let domain of domains) {
    if (!self.tempAllowlist[tab_id].includes(domain)) {
      self.tempAllowlist[tab_id].push(domain);
    }
  }

  if (!utils.hasOwn(self.tempAllowedWidgets, tab_id)) {
    self.tempAllowedWidgets[tab_id] = [];
  }
  self.tempAllowedWidgets[tab_id].push(widget_name);

  self.saveSession();
};

export default TabData;
