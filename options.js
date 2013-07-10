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

  // Set links
  $("#acceptableAdsLink").attr("href", Prefs.subscriptions_exceptionsurl);
  $("#acceptableAdsDocs").attr("href", Prefs.documentation_link.replace(/%LINK%/g, "acceptable_ads").replace(/%LANG%/g, require("utils").Utils.appLocale));

  // Add event listeners
  window.addEventListener("unload", unloadOptions, false);
  $("#updateFilterLists").click(updateFilterLists);
  $("#startSubscriptionSelection").click(startSubscriptionSelection);
  $("#subscriptionSelector").change(updateSubscriptionSelection);
  $("#addSubscription").click(addSubscription);
  $("#acceptableAds").click(allowAcceptableAds);
  $("#whitelistForm").submit(addWhitelistDomain);
  $("#removeWhitelist").click(removeSelectedExcludedDomain);
  $("#customFilterForm").submit(addTypedFilter);
  $("#removeCustomFilter").click(removeSelectedFilters);
  $("#rawFiltersButton").click(toggleFiltersInRawFormat);
  $("#importRawFilters").click(importRawFiltersText);
  FilterNotifier.addListener(onFilterChange);

  // Display jQuery UI elements
  $("#tabs").tabs();
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});

  // Popuplate option checkboxes
  initCheckbox("shouldShowIcon");
  initCheckbox("shouldShowBlockElementMenu");
  initCheckbox("hidePlaceholders");

  // Load recommended subscriptions
  loadRecommendations();

  // Show user's filters
  reloadFilters();
}
$(loadOptions);

// Reloads the displayed subscriptions and filters
function reloadFilters()
{
  // Load user filter URLs
  var container = document.getElementById("filterLists");
  while (container.lastChild)
    container.removeChild(container.lastChild);

  var hasAcceptable = false;
  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (subscription instanceof SpecialSubscription)
      continue;

    if (subscription.url == Prefs.subscriptions_exceptionsurl)
    {
      hasAcceptable = true;
      continue;
    }

    addSubscriptionEntry(subscription);
  }

  $("#acceptableAds").prop("checked", hasAcceptable);

  // User-entered filters
  showUserFilters();
}

// Cleans up when the options window is closed
function unloadOptions()
{
  FilterNotifier.removeListener(onFilterChange);
}

function initCheckbox(id)
{
  var checkbox = document.getElementById(id);
  checkbox.checked = typeof localStorage[id] == "undefined" ? true : localStorage[id] == "true";
  checkbox.addEventListener("click", function()
  {
    localStorage[id] = checkbox.checked;
  }, false);
}

function showUserFilters()
{
  var filters = [];
  var exceptions = [];
  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (!(subscription instanceof SpecialSubscription))
      continue;

    for (var j = 0; j < subscription.filters.length; j++)
    {
      var filter = subscription.filters[j];
      if (filter instanceof WhitelistFilter && /^@@\|\|([^\/:]+)\^\$document$/.test(filter.text))
        exceptions.push(RegExp.$1)
      else
        filters.push(filter.text);
    }
  }

  populateList("userFiltersBox", filters);
  populateList("excludedDomainsBox", exceptions);
}

var delayedSubscriptionSelection = null;

function loadRecommendations()
{
  var request = new XMLHttpRequest();
  request.open("GET", "subscriptions.xml");
  request.onload = function()
  {
    var selectedIndex = 0;
    var selectedPrefix = null;
    var matchCount = 0;

    var list = document.getElementById("subscriptionSelector");
    var elements = request.responseXML.documentElement.getElementsByTagName("subscription");
    for (var i = 0; i < elements.length; i++)
    {
      var element = elements[i];
      var option = new Option();
      option.text = element.getAttribute("title") + " (" + element.getAttribute("specialization") + ")";
      option._data = {
        title: element.getAttribute("title"),
        url: element.getAttribute("url"),
        homepage: element.getAttribute("homepage")
      };

      var prefix = require("utils").Utils.checkLocalePrefixMatch(element.getAttribute("prefixes"));
      if (prefix)
      {
        option.style.fontWeight = "bold";
        option.style.backgroundColor = "#E0FFE0";
        option.style.color = "#000000";
        if (!selectedPrefix || selectedPrefix.length < prefix.length)
        {
          selectedIndex = i;
          selectedPrefix = prefix;
          matchCount = 1;
        }
        else if (selectedPrefix && selectedPrefix.length == prefix.length)
        {
          matchCount++;

          // If multiple items have a matching prefix of the same length:
          // Select one of the items randomly, probability should be the same
          // for all items. So we replace the previous match here with
          // probability 1/N (N being the number of matches).
          if (Math.random() * matchCount < 1)
          {
            selectedIndex = i;
            selectedPrefix = prefix;
          }
        }
      }
      list.appendChild(option);
    }

    var option = new Option();
    option.text = i18n.getMessage("filters_addSubscriptionOther_label") + "\u2026";
    option._data = null;
    list.appendChild(option);

    list.selectedIndex = selectedIndex;

    if (delayedSubscriptionSelection)
      startSubscriptionSelection.apply(null, delayedSubscriptionSelection);
  };
  request.send(null);
}

function startSubscriptionSelection(title, url)
{
  var list = document.getElementById("subscriptionSelector");
  if (list.length == 0)
  {
    delayedSubscriptionSelection = [title, url];
    return;
  }

  $('#tabs').tabs('select', 0);
  $("#addSubscriptionContainer").show();
  $("#addSubscriptionButton").hide();
  $("#subscriptionSelector").focus();
  if (typeof url != "undefined")
  {
    list.selectedIndex = list.length - 1;
    document.getElementById("customSubscriptionTitle").value = title;
    document.getElementById("customSubscriptionLocation").value = url;
  }
  updateSubscriptionSelection();
  document.getElementById("addSubscriptionContainer").scrollIntoView(true);
}

function updateSubscriptionSelection()
{
  var list = document.getElementById("subscriptionSelector");
  var data = list.options[list.selectedIndex]._data;
  if (data)
    $("#customSubscriptionContainer").hide();
  else
  {
    $("#customSubscriptionContainer").show();
    $("#customSubscriptionTitle").focus();
  }
}

function addSubscription()
{
  var list = document.getElementById("subscriptionSelector");
  var data = list.options[list.selectedIndex]._data;
  if (data)
    doAddSubscription(data.url, data.title, data.homepage);
  else
  {
    var url = document.getElementById("customSubscriptionLocation").value.replace(/^\s+/, "").replace(/\s+$/, "");
    if (!/^https?:/i.test(url))
    {
      alert(i18n.getMessage("global_subscription_invalid_location"));
      $("#customSubscriptionLocation").focus();
      return;
    }

    var title = document.getElementById("customSubscriptionTitle").value.replace(/^\s+/, "").replace(/\s+$/, "");
    if (!title)
      title = url;

    doAddSubscription(url, title, null);
  }

  $("#addSubscriptionContainer").hide();
  $("#customSubscriptionContainer").hide();
  $("#addSubscriptionButton").show();
}

function doAddSubscription(url, title, homepage)
{
  if (url in FilterStorage.knownSubscriptions)
    return;

  var subscription = Subscription.fromURL(url);
  if (!subscription)
    return;

  subscription.title = title;
  if (homepage)
    subscription.homepage = homepage;
  FilterStorage.addSubscription(subscription);

  if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
    Synchronizer.execute(subscription);
}

function allowAcceptableAds(event)
{
  var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
  if (!subscription)
    return;

  subscription.disabled = false;
  subscription.title = "Allow non-intrusive advertising";
  if ($("#acceptableAds").prop("checked"))
  {
    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
      Synchronizer.execute(subscription);
  }
  else
    FilterStorage.removeSubscription(subscription);
}

function findSubscriptionElement(subscription)
{
  var children = document.getElementById("filterLists").childNodes;
  for (var i = 0; i < children.length; i++)
    if (children[i]._subscription == subscription)
      return children[i];
  return null;
}

function updateSubscriptionInfo(element)
{
  var subscription = element._subscription;

  var title = element.getElementsByClassName("subscriptionTitle")[0];
  title.textContent = subscription.title;
  title.setAttribute("title", subscription.url);
  if (subscription.homepage)
    title.href = subscription.homepage;
  else
    title.href = subscription.url;

  var enabled = element.getElementsByClassName("subscriptionEnabled")[0];
  enabled.checked = !subscription.disabled;

  var lastUpdate = element.getElementsByClassName("subscriptionUpdate")[0];
  lastUpdate.classList.remove("error");
  if (Synchronizer.isExecuting(subscription.url))
    lastUpdate.textContent = i18n.getMessage("filters_subscription_lastDownload_inProgress");
  else if (subscription.downloadStatus && subscription.downloadStatus != "synchronize_ok")
  {
    var map =
    {
      "synchronize_invalid_url": "filters_subscription_lastDownload_invalidURL",
      "synchronize_connection_error": "filters_subscription_lastDownload_connectionError",
      "synchronize_invalid_data": "filters_subscription_lastDownload_invalidData",
      "synchronize_checksum_mismatch": "filters_subscription_lastDownload_checksumMismatch"
    };
    if (subscription.downloadStatus in map)
      lastUpdate.textContent = i18n.getMessage(map[subscription.downloadStatus]);
    else
      lastUpdate.textContent = subscription.downloadStatus;
    lastUpdate.classList.add("error");
  }
  else if (subscription.lastDownload > 0)
  {
    var timeDate = i18n_timeDateStrings(subscription.lastDownload * 1000);
    var messageID = (timeDate[1] ? "last_updated_at" : "last_updated_at_today");
    lastUpdate.textContent = i18n.getMessage(messageID, timeDate);
  }
}

function onFilterChange(action, item, param1, param2)
{
  switch (action)
  {
    case "load":
      reloadFilters();
      break;
    case "subscription.title":
    case "subscription.disabled":
    case "subscription.homepage":
    case "subscription.lastDownload":
    case "subscription.downloadStatus":
      var element = findSubscriptionElement(item);
      if (element)
        updateSubscriptionInfo(element);
      break;
    case "subscription.added":
      if (item instanceof SpecialSubscription)
      {
        for (var i = 0; i < item.filters.length; i++)
          onFilterChange("filter.added", item.filters[i]);
      }
      else if (item.url == Prefs.subscriptions_exceptionsurl)
        $("#acceptableAds").prop("checked", true);
      else if (!findSubscriptionElement(item))
        addSubscriptionEntry(item);
      break;
    case "subscription.removed":
      if (item instanceof SpecialSubscription)
      {
        for (var i = 0; i < item.filters.length; i++)
          onFilterChange("filter.removed", item.filters[i]);
      }
      else if (item.url == Prefs.subscriptions_exceptionsurl)
        $("#acceptableAds").prop("checked", false);
      else
      {
        var element = findSubscriptionElement(item);
        if (element)
          element.parentNode.removeChild(element);
      }
      break;
    case "filter.added":
      if (item instanceof WhitelistFilter && /^@@\|\|([^\/:]+)\^\$document$/.test(item.text))
        appendToListBox("excludedDomainsBox", RegExp.$1);
      else
        appendToListBox("userFiltersBox", item.text);
      break;
    case "filter.removed":
      if (item instanceof WhitelistFilter && /^@@\|\|([^\/:]+)\^\$document$/.test(item.text))
        removeFromListBox("excludedDomainsBox", RegExp.$1);
      else
        removeFromListBox("userFiltersBox", item.text);
      break;
  }
}

// Populates a list box with a number of entries
function populateList(id, entries)
{
  var list = document.getElementById(id);
  while (list.lastChild)
    list.removeChild(list.lastChild);

  entries.sort();
  for (var i = 0; i < entries.length; i++)
  {
    var option = new Option();
    option.text = entries[i];
    option.value = entries[i];
    list.appendChild(option);
  }
}

// Add a filter string to the list box.
function appendToListBox(boxId, text)
{
  var elt = new Option();  /* Note: document.createElement("option") is unreliable in Opera */
  elt.text = text;
  elt.value = text;
  document.getElementById(boxId).appendChild(elt);
}

// Remove a filter string from a list box.
function removeFromListBox(boxId, text)
{
  var list = document.getElementById(boxId);
  for (var i = 0; i < list.length; i++)
    if (list.options[i].value == text)
      list.remove(i--);
}

function addWhitelistDomain(event)
{
  event.preventDefault();

  var domain = document.getElementById("newWhitelistDomain").value.replace(/\s/g, "");
  document.getElementById("newWhitelistDomain").value = "";
  if (!domain)
    return;

  var filterText = "@@||" + domain + "^$document";
  FilterStorage.addFilter(Filter.fromText(filterText));
}

// Adds filter text that user typed to the selection box
function addTypedFilter(event)
{
  event.preventDefault();

  var filterText = Filter.normalize(document.getElementById("newFilter").value);
  document.getElementById("newFilter").value = "";
  if (!filterText)
    return;

  FilterStorage.addFilter(Filter.fromText(filterText));
}

// Removes currently selected whitelisted domains
function removeSelectedExcludedDomain()
{
  var excludedDomainsBox = document.getElementById("excludedDomainsBox");
  var remove = [];
  for (var i = 0; i < excludedDomainsBox.length; i++)
    if (excludedDomainsBox.options[i].selected)
      remove.push(excludedDomainsBox.options[i].value);
  if (!remove.length)
    return;

  for (var i = 0; i < remove.length; i++)
    FilterStorage.removeFilter(Filter.fromText("@@||" + remove[i] + "^$document"));
}

// Removes all currently selected filters
function removeSelectedFilters()
{
  var userFiltersBox = document.getElementById("userFiltersBox");
  var remove = [];
  for (var i = 0; i < userFiltersBox.length; i++)
    if (userFiltersBox.options[i].selected)
      remove.push(userFiltersBox.options[i].value);
  if (!remove.length)
    return;

  for (var i = 0; i < remove.length; i++)
    FilterStorage.removeFilter(Filter.fromText(remove[i]));
}

// Shows raw filters box and fills it with the current user filters
function toggleFiltersInRawFormat(event)
{
  event.preventDefault();

  $("#rawFilters").toggle();
  if ($("#rawFilters").is(":visible"))
  {
    var userFiltersBox = document.getElementById("userFiltersBox");
    var text = "";
    for (var i = 0; i < userFiltersBox.length; i++)
      text += userFiltersBox.options[i].value + "\n";
    document.getElementById("rawFiltersText").value = text;
  }
}

// Imports filters in the raw text box
function importRawFiltersText()
{
  $("#rawFilters").hide();
  var filters = document.getElementById("rawFiltersText").value.split("\n");
  var seenFilter = {__proto__: null};
  for (var i = 0; i < filters.length; i++)
  {
    var text = Filter.normalize(filters[i]);
    if (!text)
      continue;

    // Don't import filter list header
    if (/^\[/.test(text))
      continue;

    FilterStorage.addFilter(Filter.fromText(text));
    seenFilter[text] = true;
  }

  var remove = [];
  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (!(subscription instanceof SpecialSubscription))
      continue;

    for (var j = 0; j < subscription.filters.length; j++)
    {
      var filter = subscription.filters[j];
      if (filter instanceof WhitelistFilter && /^@@\|\|([^\/:]+)\^\$document$/.test(filter.text))
        continue;

      if (!(filter.text in seenFilter))
        remove.push(filter);
    }
  }
  for (var i = 0; i < remove.length; i++)
    FilterStorage.removeFilter(remove[i]);
}

// Called when user explicitly requests filter list updates
function updateFilterLists()
{
  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (subscription instanceof DownloadableSubscription)
      Synchronizer.execute(subscription, true, true);
  }
}

// Adds a subscription entry to the UI.
function addSubscriptionEntry(subscription)
{
  var template = document.getElementById("subscriptionTemplate");
  var element = template.cloneNode(true);
  element.removeAttribute("id");
  element._subscription = subscription;

  var removeButton = element.getElementsByClassName("subscriptionRemoveButton")[0];
  removeButton.setAttribute("title", removeButton.textContent);
  removeButton.textContent = "\xD7";
  removeButton.addEventListener("click", function()
  {
    if (!confirm(i18n.getMessage("global_remove_subscription_warning")))
      return;

    FilterStorage.removeSubscription(subscription);
  }, false);

  var enabled = element.getElementsByClassName("subscriptionEnabled")[0];
  enabled.addEventListener("click", function()
  {
    if (subscription.disabled == !enabled.checked)
      return;

    subscription.disabled = !enabled.checked;
  }, false);

  updateSubscriptionInfo(element);

  document.getElementById("filterLists").appendChild(element);
}
