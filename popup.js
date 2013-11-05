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
var require = backgroundPage.require;
var imports = ["require", "isWhitelisted", "extractHostFromURL", "refreshIconAndContextMenu", "getAction", "getAllOriginsForTab", "console", "whitelistUrl"];
for (var i = 0; i < imports.length; i++)
  window[imports[i]] = backgroundPage[imports[i]];


with(require("filterClasses"))
{
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
  this.SpecialSubscription = SpecialSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var matcherStore = require("matcher").matcherStore;

var tab = null;

function init()
{
  console.log("Initializing popup.js");
  // Attach event listeners
  $("#activate_btn").click(activate);
  $("#deactivate_btn").click(deactivate);
  //$("#enabled").click(toggleEnabled);
  
  // Initialize based on activation state
  $(document).ready(function () {
    if(localStorage.enabled == "false")
    {
      $("#activate_btn").show();
      $("#deactivate_btn").hide();
      $(".clicker").toggleClass("greyed");
    }
  });
 
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
  localStorage.enabled = "true";
  refreshIconAndContextMenu(tab);
}

function deactivate() {
  $("#activate_btn").toggle();
  $("#deactivate_btn").toggle();
  $(".clicker").toggleClass("greyed");
  localStorage.enabled = "false";
  refreshIconAndContextMenu(tab);
}

function toggleEnabled() {
  console.log("Refreshing icon and context menu");
  refreshIconAndContextMenu(tab);
}

// ugly helpers: not to be used!
function _addOriginHTML(origin, printable, action) {
  //console.log("Popup: adding origin HTML for " + origin);
  var classes = ["clicker"];
  if(localStorage.enabled == "false")
    classes.push("greyed");
  if (action.indexOf("user") == 0) {
    classes.push("userset");
    action = action.substr(4);
  }
  if (action == "block" || action == "cookieblock")
    classes.push(action);
  var classText = 'class="' + classes.join(" ") + '"';
  return printable + '<div class="click-nav"><ul class="js"><li> \
    <a href="#" ' + classText + 'data-origin="' + origin + '" data-original-action="' + action + '">' + origin + '</a></li></ul></div>';
}

function toggleBlockedStatus(elt) {
  var originalAction = elt.getAttribute('data-original-action');
  if ($(elt).hasClass("block"))
    $(elt).toggleClass("block");
  else if ($(elt).hasClass("cookieblock")) {
    $(elt).toggleClass("block");
    $(elt).toggleClass("cookieblock");
  }
  else 
    $(elt).toggleClass("cookieblock");
  if ($(elt).hasClass(originalAction) || (originalAction == 'noaction' && !($(elt).hasClass("block") || 
                                                                            $(elt).hasClass("cookieblock"))))
    $(elt).removeClass("userset");
  else
    $(elt).addClass("userset");
}

function refreshPopup(tabId) {
  console.log("Refreshing popup for tab id " + tabId);
  var origins = getAllOriginsForTab(tabId);
  if (!origins || origins.length == 0) {
    document.getElementById("blockedResources").innerHTML = "No blockworthy resources found :)";
    return;
  }
  // old text that could go in printable: 
  // "Suspicious 3rd party domains in this page.  Red: we've blocked it; 
  // yellow: only cookies blocked; blue: no blocking yet";
  var printable = '<div id="associatedTab" data-tab-id="' + tabId + '"></div>';
  for (var i=0; i < origins.length; i++) {
    var origin = origins[i];
    // todo: gross hack, use templating framework
    printable = _addOriginHTML(origin, printable, getAction(tabId, origin));
  }
  document.getElementById("blockedResources").innerHTML = printable;
  $('.clicker').click(function() {
    toggleBlockedStatus(this);
  });
  console.log("Done refreshing popup");
}

function reloadPage() {
  // todo: fill in
  console.log("Reload page called");
}

function saveAction(userAction, origin) {
  var allUserActions = {'block': 'userRed', 
                        'cookieblock': 'userYellow', 
                        'noaction': 'userBlue'};
  console.log("Saving user action " + userAction + " for " + origin);
  for (var action in allUserActions) {
    var filter = Filter.fromText("||" + origin + "^$third_party");
    if (action == userAction)
      FilterStorage.addFilter(filter, FilterStorage.knownSubscriptions[allUserActions[action]]);
    else
      FilterStorage.removeFilter(filter, FilterStorage.knownSubscriptions[allUserActions[action]]);
  }
  console.log("Finished saving action " + userAction + " for " + origin);
  // todo: right now we don't determine whether a reload is needed
  return true;
}

function syncSettingsDict(settingsDict) {
  // track whether reload is needed: only if things are being unblocked
  var reloadNeeded = false;
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  // we get the blocked data again in case anything changed, but the user's change when
  // closing a popup is authoritative and we should sync the real state to that
  for (var origin in settingsDict) {
    var userAction = settingsDict[origin];
    if (saveAction(userAction, origin))
      reloadNeeded = true; // js question: slower than "if (!reloadNeeded) reloadNeeded = true"?
                           // would be fun to check with jsperf.com
  }
  console.log("Finished syncing. Now refreshing popup.");
  // the popup needs to be refreshed to display current results
  refreshPopup(tabId);
  return reloadNeeded;
}

function getCurrentClass(elt) {
  if ($(elt).hasClass("block"))
    return "block";
  else if ($(elt).hasClass("cookieblock"))
    return "cookieblock";
  else
    return "noaction";
}

function buildSettingsDict() {
  var settingsDict = {};
  $('.clicker').each(function() {
    var origin = $(this).attr("data-origin");
    if ($(this).hasClass("userset") && getCurrentClass(this) != $(this).attr("data-original-action")) {
      // todo: DRY; same as code above, break out into helper
      if ($(this).hasClass("block"))
        settingsDict[origin] = "block";
      else if ($(this).hasClass("cookieblock"))
        settingsDict[origin] = "cookieblock";
      else
        settingsDict[origin] = "noaction";
    }
  });
  return settingsDict;
}

// syncs the user-selected cookie blocking options, etc
function syncUISelections() {
  var settingsDict = buildSettingsDict();
  console.log("Sync of userset options: " + JSON.stringify(settingsDict));
  if (syncSettingsDict(settingsDict))
    reloadPage();
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, function(tab) {
    refreshPopup(tab.id);
  });
});
window.addEventListener('unload', function() {
  console.log("Starting to unload popup");
  syncUISelections();
  console.log("unloaded popup");
});

