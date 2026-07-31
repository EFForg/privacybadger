/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2026 Electronic Frontier Foundation
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

import { getDntScriptExcludeMatches } from "./utils.js";

import constants from "../../js/constants.js";

function subscribeContentScriptsToStorageUpdates() {
  let settingsStore = badger.getSettings(),
    privateStore = badger.getPrivateSettings();

  settingsStore.subscribe("set:sendDNTSignal", function (enabled) {
    if (enabled) {
      let dntScript = constants.CONTENT_SCRIPTS.find(item => item.id == "dnt_signal");
      dntScript.excludeMatches = getDntScriptExcludeMatches();
      browser.scripting.registerContentScripts([dntScript]);
    } else {
      browser.scripting.unregisterContentScripts({
        ids: ["dnt_signal"]
      });
    }
  });
  settingsStore.subscribe("set:disabledSites", function (siteDomains) {
    browser.scripting.updateContentScripts([{
      id: "dnt_signal",
      excludeMatches: getDntScriptExcludeMatches({
        disabledSites: siteDomains
      })
    }]).catch(function () {
      // ignore "Content script with ID 'foo' does not exist or is not fully registered"
    });
  });

  privateStore.subscribe("set:gpcDisabledSites", function (gpcExceptions) {
    browser.scripting.updateContentScripts([{
      id: "dnt_signal",
      excludeMatches: getDntScriptExcludeMatches({
        gpcDisabledHosts: Object.keys(gpcExceptions)
      })
    }]).catch(function () {});
  });
}

export {
  subscribeContentScriptsToStorageUpdates
};

