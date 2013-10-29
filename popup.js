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
  console.log("Popup: adding origin HTML for " + origin);
  var classes = ["clicker"];
  // only add cookieblocked class if origin isn't blocked
  if (blocked)
    classes.push("blocked");
  else if (shouldCookieBlock)
    classes.push("cookieblocked");
  var classText = 'class="' + classes.join(" ") + '"';
  console.log("classText is " + classText);
  return printable + '<div class="click-nav"><ul class="js"><li> \
    <a href="#" ' + classText + '>' + origin + '</a></li></ul></div>';
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

function addBlocked(tab) {
  var blockedData = getBlockedData(tab.id);
  if (blockedData != null) {
    // old text that could go in printable: 
    // "Suspicious 3rd party domains in this page.  Red: we've blocked it; yellow: only cookies blocked; blue: no blocking yet";
    var printable = "";
    for (var origin in blockedData) {
      // todo: fix; this causes collisions e.g. a.foo.com and afoo.com
      var origin_id = origin.replace(/\W/g, '');
      console.log("menuing " + origin + " -> " + JSON.stringify(blockedData[origin]));
      var criteria = blockedData[origin];
      var originBlocked = criteria["frequencyHeuristic"] && !criteria[window.whitelistUrl];
      var shouldCookieBlock = !criteria["cookieWhitelist"];
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

// syncs the user-selected cookie blocking options, etc
function syncUISelections() {
  // todo: sync selections
  // todo: see if the current selection matches what we have, reload if so
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, addBlocked);
});

window.addEventListener('unload', function() {
  syncUISelections();
  console.log("unloaded popup");
});
