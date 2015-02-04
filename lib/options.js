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
var imports = ["require", "saveAction"]
for (var i = 0; i < imports.length; i++){
      window[imports[i]] = backgroundPage[imports[i]];
}
var Utils = require("utils").Utils;

with(require("filterClasses"))
{
  this.Filter = Filter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.SpecialSubscription = SpecialSubscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var Prefs = require("prefs").Prefs;
var Synchronizer = require("synchronizer").Synchronizer;

// Loads options from localStorage and sets UI elements accordingly
function loadOptions()
{
  // Set page title to i18n version of "Adblock Plus Options"
  document.title = i18n.getMessage("options");

  // Add event listeners
  window.addEventListener("unload", unloadOptions, false);
  $("#whitelistForm").submit(addWhitelistDomain);
  $("#removeWhitelist").click(removeWhitelistDomain);
  $("#noactionAdd").click(noactionAdd);
  $("#cookieblockAdd").click(cookieblockAdd);
  $("#blockAdd").click(blockAdd);
  $("#noactionMove").click(noactionFilter);
  $("#cookieblockMove").click(cookieblockFilter);
  $("#blockMove").click(blockFilter);
  $("#remove").click(removeFilter);
  FilterNotifier.addListener(onFilterChange);

  // Display jQuery UI elements
  $("#tabs").tabs();
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});

  // Show user's filters
  reloadWhitelist();
  reloadColorLists();
}
$(loadOptions);

function reloadWhitelist()
{
  var sites = JSON.parse(localStorage.disabledSites);
  var sitesList = $('#excludedDomainsBox');
  sitesList.html("");
  for( var i = 0; i < sites.length; i++){
    $('<option>').text(sites[i]).appendTo(sitesList); 
  }

}

function reloadColorLists()
{
  var green = FilterStorage.knownSubscriptions.userGreen.filters;
  var yellow = FilterStorage.knownSubscriptions.userYellow.filters;
  var red = FilterStorage.knownSubscriptions.userRed.filters;
  var greenList = $('#userGreenDomainsBox');
  var yellowList = $('#userYellowDomainsBox');
  var redList = $('#userRedDomainsBox');
  greenList.html("");
  for( var i = 0; i < green.length; i++){
    $('<option>').text(green[i].text.replace("||","").replace("^$third-party","")).appendTo(greenList); 
  }
  yellowList.html("");
  for( var i = 0; i < yellow.length; i++){
    $('<option>').text(yellow[i].text.replace("||","").replace("^$third-party","")).appendTo(yellowList); 
  }
  redList.html("");
  for( var i = 0; i < red.length; i++){
    $('<option>').text(red[i].text.replace("||","").replace("^$third-party","")).appendTo(redList); 
  }
}

// Cleans up when the options window is closed
function unloadOptions()
{
  FilterNotifier.removeListener(onFilterChange);
}

function onFilterChange(action, item, param1, param2)
{
    reloadColorLists();
}

function addWhitelistDomain(event)
{
  event.preventDefault();

  var domain = document.getElementById("newWhitelistDomain").value.replace(/\s/g, "");
  document.getElementById("newWhitelistDomain").value = "";
  if (!domain)
    return;

  Utils.disablePrivacyBadgerForOrigin(domain)
  reloadWhitelist()
}

function removeWhitelistDomain(event)
{
  var selected = $(document.getElementById("excludedDomainsBox")).find('option:selected');
  for(var i = 0; i < selected.length; i++){
    Utils.enablePrivacyBadgerForOrigin(selected[i].text);
  }
  reloadWhitelist();
}

function getSelectedColoredOptions()
{
  var selectedGreen = $(document.getElementById("userGreenDomainsBox")).find('option:selected');
  var selectedYellow = $(document.getElementById("userYellowDomainsBox")).find('option:selected');
  var selectedRed = $(document.getElementById("userRedDomainsBox")).find('option:selected');
  return [selectedGreen , selectedYellow , selectedRed]
}

function saveActionWithType(type, selected)
{
  for( var i = 0; i < selected.length; i++){
    for( var j = 0; j < selected[i].length; j++){
      saveAction(type, selected[i][j].text);
    }
  }

}

function noactionAdd(event)
{
  var domain = document.getElementById("newFilterDomain").value.replace(/\s/g, "");
  document.getElementById("newFilterDomain").value = "";
  if (!domain)
    return;
  saveAction('noaction', domain);
  reloadColorLists();
}

function cookieblockAdd(event)
{
  var domain = document.getElementById("newFilterDomain").value.replace(/\s/g, "");
  document.getElementById("newFilterDomain").value = "";
  if (!domain)
    return;
  saveAction('cookieblock', domain);
  reloadColorLists();
}

function blockAdd(event)
{
  var domain = document.getElementById("newFilterDomain").value.replace(/\s/g, "");
  document.getElementById("newFilterDomain").value = "";
  if (!domain)
    return;
  saveAction('block', domain);
  reloadColorLists();
}

function noactionFilter(event)
{
  selected = getSelectedColoredOptions();
  saveActionWithType('noaction', selected);
  reloadColorLists();
}

function cookieblockFilter(event)
{
  selected = getSelectedColoredOptions();
  saveActionWithType('cookieblock', selected);
  reloadColorLists();
}

function blockFilter(event)
{
  selected = getSelectedColoredOptions();
  saveActionWithType('block', selected);
  reloadColorLists();
}

function removeFilter(event)
{
    selected = getSelectedColoredOptions();
    saveActionWithType('', selected);
    reloadColorLists();
}
