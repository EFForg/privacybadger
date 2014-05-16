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

if ("webNavigation" in chrome)
{
  var tabsLoading = {};

  chrome.webNavigation.onCreatedNavigationTarget.addListener(function(details)
  {
    if (isFrameWhitelisted(details.sourceTabId, details.sourceFrameId))
      return;

    var openerUrl = getFrameUrl(details.sourceTabId, details.sourceFrameId);
    if (!openerUrl)
    {
      // We don't know the opener tab
      return;
    }
    tabsLoading[details.tabId] = openerUrl;

    checkPotentialPopup(details.tabId, details.url, openerUrl);
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab)
  {
    if (!(tabId in tabsLoading))
    {
      // Not a pop-up we've previously seen
      return;
    }

    if ("url" in changeInfo)
      checkPotentialPopup(tabId, tab.url, tabsLoading[tabId]);

    if ("status" in changeInfo && changeInfo.status == "complete" && tab.url != "about:blank")
      delete tabsLoading[tabId];
  });
}

function checkPotentialPopup(tabId, url, opener)
{
  var requestHost = extractHostFromURL(url);
  var documentHost = extractHostFromURL(opener);
  var thirdParty = isThirdParty(requestHost, documentHost);
  var filter = defaultMatcher.matchesAny(url || "about:blank", "POPUP", documentHost, thirdParty);
  if (filter instanceof BlockingFilter)
    chrome.tabs.remove(tabId);
}
