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

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let subscriptionListLoading = false;

function init()
{
  if (window.arguments && window.arguments.length && window.arguments[0])
  {
    let source = window.arguments[0];
    setCustomSubscription(source.title, source.url,
                          source.mainSubscriptionTitle, source.mainSubscriptionURL);

    E("all-subscriptions-container").hidden = true;
    E("fromWebText").hidden = false;
  }
  else
    loadSubscriptionList();
}

function updateSubscriptionInfo()
{
  let selectedSubscription = E("all-subscriptions").selectedItem;

  E("subscriptionInfo").setAttribute("invisible", !selectedSubscription);
  if (selectedSubscription)
  {
    let url = selectedSubscription.getAttribute("_url");
    let homePage = selectedSubscription.getAttribute("_homepage")

    let viewLink = E("view-list");
    viewLink.setAttribute("_url", url);
    viewLink.setAttribute("tooltiptext", url);

    let homePageLink = E("visit-homepage");
    homePageLink.hidden = !homePage;
    if (homePage)
    {
      homePageLink.setAttribute("_url", homePage);
      homePageLink.setAttribute("tooltiptext", homePage);
    }
  }
}

function reloadSubscriptionList()
{
  subscriptionListLoading = false;
  loadSubscriptionList();
}

function loadSubscriptionList()
{
  if (subscriptionListLoading)
    return;

  E("all-subscriptions-container").selectedIndex = 0;
  E("all-subscriptions-loading").hidden = false;

  let request = new XMLHttpRequest();
  let errorHandler = function()
  {
    E("all-subscriptions-container").selectedIndex = 2;
    E("all-subscriptions-loading").hidden = true;
  };
  let successHandler = function()
  {
    if (!request.responseXML || request.responseXML.documentElement.localName != "subscriptions")
    {
      errorHandler();
      return;
    }

    try
    {
      processSubscriptionList(request.responseXML);
      E("all-subscriptions").selectedIndex = 0;
      E("all-subscriptions").focus();
    }
    catch (e)
    {
      Cu.reportError(e);
      errorHandler();
    }
  };

  request.open("GET", Prefs.subscriptions_listurl);
  request.addEventListener("error", errorHandler, false);
  request.addEventListener("load", successHandler, false);
  request.send(null);

  subscriptionListLoading = true;
}

function processSubscriptionList(doc)
{
  let list = E("all-subscriptions");
  while (list.firstChild)
    list.removeChild(list.firstChild);

  addSubscriptions(list, doc.documentElement, 0, null, null);
  E("all-subscriptions-container").selectedIndex = 1;
  E("all-subscriptions-loading").hidden = true;
}

function addSubscriptions(list, parent, level, parentTitle, parentURL)
{
  for (let i = 0; i < parent.childNodes.length; i++)
  {
    let node = parent.childNodes[i];
    if (node.nodeType != Node.ELEMENT_NODE || node.localName != "subscription")
      continue;

    if (node.getAttribute("type") != "ads" || node.getAttribute("deprecated") == "true")
      continue;

    let variants = node.getElementsByTagName("variants");
    if (!variants.length || !variants[0].childNodes.length)
      continue;
    variants = variants[0].childNodes;

    let isFirst = true;
    let mainTitle = null;
    let mainURL = null;
    for (let j = 0; j < variants.length; j++)
    {
      let variant = variants[j];
      if (variant.nodeType != Node.ELEMENT_NODE || variant.localName != "variant")
        continue;

      let item = document.createElement("richlistitem");
      item.setAttribute("_title", variant.getAttribute("title"));
      item.setAttribute("_url", variant.getAttribute("url"));
      if (parentTitle && parentURL && variant.getAttribute("complete") != "true")
      {
        item.setAttribute("_supplementForTitle", parentTitle);
        item.setAttribute("_supplementForURL", parentURL);
      }
      item.setAttribute("tooltiptext", variant.getAttribute("url"));
      item.setAttribute("_homepage", node.getAttribute("homepage"));

      let title = document.createElement("description");
      if (isFirst)
      {
        if (Utils.checkLocalePrefixMatch(node.getAttribute("prefixes")))
          title.setAttribute("class", "subscriptionTitle localeMatch");
        else
          title.setAttribute("class", "subscriptionTitle");
        title.textContent = node.getAttribute("title") + " (" + node.getAttribute("specialization") + ")";
        mainTitle = variant.getAttribute("title");
        mainURL = variant.getAttribute("url");
        isFirst = false;
      }
      title.setAttribute("flex", "1");
      title.style.marginLeft = (20 * level) + "px";
      item.appendChild(title);

      let variantTitle = document.createElement("description");
      variantTitle.setAttribute("class", "variant");
      variantTitle.textContent = variant.getAttribute("title");
      variantTitle.setAttribute("crop", "end");
      item.appendChild(variantTitle);

      list.appendChild(item);
    }

    let supplements = node.getElementsByTagName("supplements");
    if (supplements.length)
      addSubscriptions(list, supplements[0], level + 1, mainTitle, mainURL);
  }
}

function onSelectionChange()
{
  let selectedItem = E("all-subscriptions").selectedItem;
  if (!selectedItem)
    return;

  setCustomSubscription(selectedItem.getAttribute("_title"), selectedItem.getAttribute("_url"),
                        selectedItem.getAttribute("_supplementForTitle"), selectedItem.getAttribute("_supplementForURL"));

  updateSubscriptionInfo();
}

function setCustomSubscription(title, url, mainSubscriptionTitle, mainSubscriptionURL)
{
  E("title").value = title;
  E("location").value = url;

  let messageElement = E("supplementMessage");
  let addMainCheckbox = E("addMainSubscription");
  if (mainSubscriptionURL && !hasSubscription(mainSubscriptionURL))
  {
    messageElement.removeAttribute("invisible");
    addMainCheckbox.removeAttribute("invisible");

    let [, beforeLink, afterLink] = /(.*)\?1\?(.*)/.exec(messageElement.getAttribute("_textTemplate")) || [null, messageElement.getAttribute("_textTemplate"), ""];
    while (messageElement.firstChild)
      messageElement.removeChild(messageElement.firstChild);
    messageElement.appendChild(document.createTextNode(beforeLink));
    let link = document.createElement("label");
    link.className = "text-link";
    link.setAttribute("tooltiptext", mainSubscriptionURL);
    link.addEventListener("click", function() UI.loadInBrowser(mainSubscriptionURL), false);
    link.textContent = mainSubscriptionTitle;
    messageElement.appendChild(link);
    messageElement.appendChild(document.createTextNode(afterLink));

    addMainCheckbox.value = mainSubscriptionURL;
    addMainCheckbox.setAttribute("_mainSubscriptionTitle", mainSubscriptionTitle)
    let [label, accesskey] = Utils.splitLabel(addMainCheckbox.getAttribute("_labelTemplate"));
    addMainCheckbox.label = label.replace(/\?1\?/g, mainSubscriptionTitle);
    addMainCheckbox.accessKey = accesskey;
  }
  else
  {
    messageElement.setAttribute("invisible", "true");
    addMainCheckbox.setAttribute("invisible", "true");
  }
}

function validateURL(url)
{
  if (!url)
    return null;
  url = url.replace(/^\s+/, "").replace(/\s+$/, "");

  // Is this a file path?
  try {
    let file = new FileUtils.File(url);
    return Services.io.newFileURI(file).spec;
  } catch (e) {}

  // Is this a valid URL?
  let uri = Utils.makeURI(url);
  if (uri)
    return uri.spec;

  return null;
}

function addSubscription()
{
  let url = E("location").value;
  url = validateURL(url);
  if (!url)
  {
    Utils.alert(window, Utils.getString("subscription_invalid_location"));
    E("location").focus();
    return false;
  }

  let title = E("title").value.replace(/^\s+/, "").replace(/\s+$/, "");
  if (!title)
    title = url;

  doAddSubscription(url, title);

  let addMainCheckbox = E("addMainSubscription")
  if (addMainCheckbox.getAttribute("invisible") != "true" && addMainCheckbox.checked)
  {
    let mainSubscriptionTitle = addMainCheckbox.getAttribute("_mainSubscriptionTitle");
    let mainSubscriptionURL = validateURL(addMainCheckbox.value);
    if (mainSubscriptionURL)
      doAddSubscription(mainSubscriptionURL, mainSubscriptionTitle);
  }

  return true;
}

/**
 * Adds a new subscription to the list.
 */
function doAddSubscription(/**String*/ url, /**String*/ title)
{
  let subscription = Subscription.fromURL(url);
  if (!subscription)
    return;

  FilterStorage.addSubscription(subscription);

  subscription.disabled = false;
  subscription.title = title;

  if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
    Synchronizer.execute(subscription);
}

function hasSubscription(url)
{
  return FilterStorage.subscriptions.some(function(subscription) subscription instanceof DownloadableSubscription && subscription.url == url);
}
