/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var backgroundPage = chrome.extension.getBackgroundPage();
var imports = ["require", "isWhitelisted", "extractHostFromURL", "refreshIconAndContextMenu", "getBlockedData", "console", "whitelistUrl"];
for (var i = 0; i < imports.length; i++)
  window[imports[i]] = backgroundPage[imports[i]];

var Filter = require("filterClasses").Filter;
var FilterStorage = require("filterStorage").FilterStorage;

var tab = null;

function init()
{
  // Attach event listeners
  $("#activate_btn").click(activate);
  $("#deactivate_btn").click(deactivate);
  //$("#enabled").click(toggleEnabled);
  
  // Ask content script whether clickhide is active. If so, show cancel button.
  // If that isn't the case, ask background.html whether it has cached filters. If so,
  // ask the user whether she wants those filters.
  // Otherwise, we are in default state.
  chrome.windows.getCurrent(function(w)
  {
    chrome.tabs.getSelected(w.id, function(t)
    {
      tab = t;
//      document.getElementById("enabled").checked = !isWhitelisted(tab.url);
      document.getElementById("enabledCheckboxAndLabel").style.display = "block";
    });
  });
}
$(init);

function activate() {
  $("#activate_btn").toggle();
  $("#deactivate_btn").toggle();
  $(".clicker").toggleClass("greyed");
}

function deactivate() {
  $("#activate_btn").toggle();
  $("#deactivate_btn").toggle();
  $(".clicker").toggleClass("greyed");
}

function toggleEnabled()
{
  var checked = document.getElementById("enabled").checked;
  // if (checked)
  // {
  //   // Remove any exception rules applying to this URL
  //   var filter = isWhitelisted(tab.url);
  //   while (filter)
  //   {
  //     FilterStorage.removeFilter(filter);
  //     if (filter.subscriptions.length)
  //       filter.disabled = true;
  //     filter = isWhitelisted(tab.url);
  //   }
  // }
  // else
  // {
  //   var host = extractHostFromURL(tab.url).replace(/^www\./, "");
  //   var filter = Filter.fromText("@@||" + host + "^$document");
  //   if (filter.subscriptions.length && filter.disabled)
  //     filter.disabled = false;
  //   else
  //   {
  //     filter.disabled = false;
  //     FilterStorage.addFilter(filter);
  //   }
  // }

  console.log("Refreshing icon and context menu");
  refreshIconAndContextMenu(tab);
}

// ugly helpers: not to be used!
function _addOriginHTML(origin, printable, blocked, shouldCookieBlock) {
  //console.log("Popup: adding origin HTML for " + origin);
  var classes = ["clicker"];
  // only add cookieblocked class if origin isn't blocked
  if (blocked)
    classes.push("blocked");
  else if (shouldCookieBlock)
    classes.push("cookieblocked");
  var classText = 'class="' + classes.join(" ") + '"';
  return printable + '<div class="click-nav"><ul class="js"><li> \
    <a href="#" ' + classText + 'data-origin="' + origin + '">' + origin + '</a></li></ul></div>';
}

function toggleBlockedStatus(elt) {
  var classList = elt.className.split(" ");
  if ($.inArray("blocked", classList) != -1) {
    $(elt).toggleClass("blocked");
  }
  else if ($.inArray("cookieblocked", classList) != -1) {
    $(elt).toggleClass("blocked");
    $(elt).toggleClass("cookieblocked");
  }
  else {
    $(elt).toggleClass("cookieblocked");
  }
}

function refreshPopup(tab_id) {
  console.log("Refreshing popup for tab id " + JSON.stringify(tab_id));
  var blockedData = getBlockedData(tab_id);
  if (blockedData != null) {
    // old text that could go in printable: 
    // "Suspicious 3rd party domains in this page.  Red: we've blocked it; yellow: only cookies blocked; blue: no blocking yet";
    var printable = '<div id="associatedTab" data-tab-id="' + tab_id + '"></div>';
    for (var origin in blockedData) {
      console.log("menuing " + origin + " -> " + JSON.stringify(blockedData[origin]));
      var criteria = blockedData[origin];
      var originBlocked = criteria["frequencyHeuristic"] && !criteria[window.whitelistUrl];
      var shouldCookieBlock = !criteria["userCookieWhitelist"];
      // todo: gross hack, use templating framework
      printable = _addOriginHTML(origin, printable, originBlocked, shouldCookieBlock);
      console.log("Popup: done loading origin " + origin);
    }
    document.getElementById("blockedResources").innerHTML = printable;
    $('.clicker').click(function() {
      toggleBlockedStatus(this);
    });
  }
  else
    document.getElementById("blockedResources").innerHTML = "No blockworthy resources found :)";
}

function reloadPage() {
  // todo: fill in
  console.log("Reload page called");
}

function setFilter(subscription, origin, add, whitelistFilter){
  console.log("SetFilter called: " + subscription + " " + origin + " : " + add);
  var filterText = "";
  if (whitelistFilter)
    filterText = "@@||" + origin + "^$third_party";
  else
    filterText = "||" + origin + "^$third_party";
  var filter = this.Filter.fromText(filterText);
  if (add) {
    //console.log("actually adding the filter!");
    FilterStorage.addFilter(filter, FilterStorage.knownSubscriptions[subscription]);
  }
  else {
    //console.log("subtracting the filter");
    FilterStorage.removeFilter(filter, FilterStorage.knownSubscription[subscription]);
  }
}

function syncSettingsDict(settingsDict) {
  // track whether reload is needed: only if things are being unblocked
  var reloadNeeded = false;
  var tab_id = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  // we get the blocked data again in case anything changed, but the user's change when
  // closing a popup is authoritative and we should sync the real state to that
  var blockedData = getBlockedData(tab_id);
  for (var origin in settingsDict) {
    if (!(origin in blockedData)) {
      console.error("Error: settingsDict and blockedData dict don't have the same origins");
      continue;
    }
    if (settingsDict[origin] == "blocked") {
      // make sure it's in frequencyHeuristic list
      if (!(blockedData[origin]["frequencyHeuristic"]))
        setFilter("frequencyHeuristic", origin, true), false;
      // make sure it's NOT in the whitelist
      if (blockedData[origin][window.whitelistUrl])
        setFilter(window.whitelistUrl, origin, false, true);
    }
    else if (settingsDict[origin] == "cookieblocked") {
      // if it's in frequencyHeuristic and NOT in whitelist, this is an explicit whitelist
      if (blockedData[origin]["frequencyHeuristic"] && !(blockedData[origin][window.whitelistUrl])) {
        setFilter(window.whitelistUrl, origin, true);
        if (!reloadNeeded)
          reloadNeeded = true;
      }
    }
    else {
      // if it's unblocked, this should be on whitelist and userCookieWhitelist
      if (!(blockedData[origin][window.whitelistUrl])) {
        setFilter(window.whitelistUrl, origin, true, true);
        if (!reloadNeeded)
          reloadNeeded = true;
      }
      if (!(blockedData[origin]["userCookieWhitelist"])) {
        // todo: what format do we want to use for cookie whitelist subscription. does it matter?
        setFilter("userCookieWhitelist", origin, true, false);
        if (!reloadNeeded)
          reloadNeeded = true
      }
    }
  }
  console.log("Finished syncing. Now refreshing popup.");
  // the popup needs to be refreshed to display current results
  refreshPopup(tab_id);
  return reloadNeeded;
}

function buildSettingsDict() {
  var settingsDict = {};
  $('.clicker').each(function() {
    var origin = this.getAttribute('data-origin');
    var classList = this.className.split(" ");
    // todo: DRY; same as code above, break out into helper
    if ($.inArray("blocked", classList) != -1) {
      settingsDict[origin] = "blocked";
    }
    else if ($.inArray("cookieblocked", classList) != -1) {
      settingsDict[origin] = "cookieblocked";
    }
    else {
      settingsDict[origin] = "unblocked";
    }
  });
  return settingsDict;
}

// syncs the user-selected cookie blocking options, etc
function syncUISelections() {
  var settingsDict = buildSettingsDict();
  if (syncSettingsDict(settingsDict))
    reloadPage();
  console.log("sync is " + JSON.stringify(settingsDict));
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, function(tab) {
    console.log("adding popup html for tab.id " + JSON.stringify(tab.id));
    refreshPopup(tab.id)});
});
window.addEventListener('unload', function() {
  syncUISelections();
  console.log("unloaded popup");
});
