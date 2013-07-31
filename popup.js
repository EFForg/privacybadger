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
var imports = ["require", "isWhitelisted", "extractHostFromURL", "refreshIconAndContextMenu", "getBlockedData", "console"];
for (var i = 0; i < imports.length; i++)
  window[imports[i]] = backgroundPage[imports[i]];

var Filter = require("filterClasses").Filter;
var FilterStorage = require("filterStorage").FilterStorage;

var tab = null;

function init()
{
  // Attach event listeners
  $("#enabled").click(toggleEnabled);
  // $("#clickHideButton").click(activateClickHide);
  // $("#cancelButton").click(cancelClickHide);
  
  // Ask content script whether clickhide is active. If so, show cancel button.
  // If that isn't the case, ask background.html whether it has cached filters. If so,
  // ask the user whether she wants those filters.
  // Otherwise, we are in default state.
  chrome.windows.getCurrent(function(w)
  {
    chrome.tabs.getSelected(w.id, function(t)
    {
      tab = t;
      document.getElementById("enabled").checked = !isWhitelisted(tab.url);
      document.getElementById("enabledCheckboxAndLabel").style.display = "block";

      // chrome.tabs.sendRequest(tab.id, {reqtype: "get-clickhide-state"}, function(response)
      // {
      //   if(response.active)
      //     clickHideActiveStuff();
      //   else
      //     clickHideInactiveStuff();
      // });
    });
  });
}
$(init);

function clickOrigin() {
  $('.click-nav .js ul').slideToggle(200);
  $('.clicker').toggleClass('active');
  e.stopPropagation();
  alert("still working");
}

function toggleEnabled()
{
  var checked = document.getElementById("enabled").checked;
  if (checked)
  {
    // Remove any exception rules applying to this URL
    var filter = isWhitelisted(tab.url);
    while (filter)
    {
      FilterStorage.removeFilter(filter);
      if (filter.subscriptions.length)
        filter.disabled = true;
      filter = isWhitelisted(tab.url);
    }
  }
  else
  {
    var host = extractHostFromURL(tab.url).replace(/^www\./, "");
    var filter = Filter.fromText("@@||" + host + "^$document");
    if (filter.subscriptions.length && filter.disabled)
      filter.disabled = false;
    else
    {
      filter.disabled = false;
      FilterStorage.addFilter(filter);
    }
  }

  refreshIconAndContextMenu(tab);
}

function activateClickHide()
{
  clickHideActiveStuff();
  chrome.tabs.sendRequest(tab.id, {reqtype: "clickhide-activate"});

  // Close the popup after a few seconds, so user doesn't have to
  activateClickHide.timeout = window.setTimeout(window.close, 5000);
}

function cancelClickHide()
{
  if (activateClickHide.timeout)
  {
    window.clearTimeout(activateClickHide.timeout);
    activateClickHide.timeout = null;
  }
  clickHideInactiveStuff();
  chrome.tabs.sendRequest(tab.id, {reqtype: "clickhide-deactivate"});
}

function clickHideActiveStuff()
{
  document.getElementById("enabledCheckboxAndLabel").style.display = "none";
  document.getElementById("clickHideInactiveStuff").style.display = "none";
  document.getElementById("clickHideActiveStuff").style.display = "inherit";
}

function clickHideInactiveStuff()
{
  document.getElementById("enabledCheckboxAndLabel").style.display = "block";
  document.getElementById("clickHideActiveStuff").style.display = "none";
  document.getElementById("clickHideInactiveStuff").style.display = "inherit";
}

// ugly helpers: not to be used!
function addOriginInitialHTML(origin, printable, blocked) {
  var classText = 'class="clicker"'
  if (blocked)
    classText = 'class="clicker blocked"';
  return printable + '<div class="click-nav"><ul class="js"><li> \
    <a href="#" ' + classText + '>' + origin + '</a><ul class="js collapsible">';
}

// ugly helpers: not to be used!
function addBlockerHTML(blocker, printable, blocked) {
  // tododta: fix hack to hard code our lists in for what we want to display
  var displayBlocker = blocker;
  if (blocker == 'frequencyHeuristic')
    displayBlocker = 'EFF Blocking Laboratory';
  else if (blocker == 'https://easylist-downloads.adblockplus.org/easylist.txt')
    displayBlocker = 'Adblock Plus EasyList';
  else if (blocker == 'https://easylist-downloads.adblockplus.org/easyprivacy.txt')
    displayBlocker = 'Adblock Plus EasyPrivacy';
  else
    // just don't display anything
    return printable;
  // tododta add EasyPrivacy
  var classText = 'class="imglink"';
  if (blocked)
    classText = 'class="imglink blocked"';
  return printable + '<li><a href="#" ' + classText + '>' + displayBlocker + '</a></li>';
}

// ugly helpers: not to be used!
function addOriginClosingHTML(printable) {
  return printable + '</ul></li></ul></div>';
}

function addBlocked(tab) {
  var blockedData = getBlockedData(tab.id);
  if (blockedData != null) {
    var printable = "Here is a list of suspicious third party hosts. A red domain means that our has extension has blocked this domain, and an individual blocker is listed as red if and only if that blocker thought the domain should be blocked.";
    for (var origin in blockedData) {
      if (!('defaultMatcher' in blockedData[origin]))
        console.error("Something went very wrong...");
      // tododta: gross hacks
      printable = addOriginInitialHTML(origin, printable, blockedData[origin]['defaultMatcher']);
      for (var blocker in blockedData[origin])
        printable = addBlockerHTML(blocker, printable, blockedData[origin][blocker]);
      printable = addOriginClosingHTML(printable);
    }
    document.getElementById("blockedResources").innerHTML = printable;
    // add js for drop down list
    // tododta clean up this to be per-ui instead of collapsing all at once
    // my attempts to use this.next() to do this were mysteriously
    // thwarted :/
    $('.click-nav .js ul').hide();
    $('.click-nav .js').click(function(e) {
      $('.click-nav .js ul').slideToggle(200);
      $('.clicker').toggleClass('active');
      e.stopPropagation();
    });
  }
  else
    document.getElementById("blockedResources").innerHTML = "No blockworthy resources found :)";
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, addBlocked);
});
