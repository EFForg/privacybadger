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

chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*", "https://*/*"]}, ["requestHeaders", "blocking"]);
chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["http://*/*", "https://*/*"]}, ["responseHeaders"]);
chrome.tabs.onRemoved.addListener(forgetTab);

var onFilterChangeTimeout = null;
function onFilterChange()
{
  onFilterChangeTimeout = null;
  chrome.webRequest.handlerBehaviorChanged();
}

var importantNotifications = {
  'filter.added': true,
  'filter.removed': true,
  'filter.disabled': true,
  'subscription.added': true,
  'subscription.removed': true,
  'subscription.disabled': true,
  'subscription.updated': true,
  'load': true
};

require("filterNotifier").FilterNotifier.addListener(function(action)
{
  if (action in importantNotifications)
  {
    // Execute delayed to prevent multiple executions in a quick succession
    if (onFilterChangeTimeout != null)
      window.clearTimeout(onFilterChangeTimeout);
    onFilterChangeTimeout = window.setTimeout(onFilterChange, 2000);
  }
});

var frames = {};

function clobberCookieSetting() 
{
  console.log("Clobber cookie setting called");
  var dummyCookie = "";
  Object.defineProperty(document, "cookie", {
    __proto__: null,
    configurable: false,
    get: function () {
      console.log("clobbered cookie get called"); 
      return dummyCookie;
    },
    set: function (newValue) {
      console.log("clobbered cookie set called"); 
      dummyCookie = newValue;
    }
  });
}

function onBeforeSendHeaders(details)
{
  if (details.tabId == -1)
    return {};

  var type = details.type;
  if (type == "main_frame" || type == "sub_frame")
    recordFrame(details.tabId, details.frameId, details.parentFrameId, details.url);

  if (type == "main_frame")
    return {};

  // Type names match Mozilla's with main_frame and sub_frame being the only exceptions.
  if (type == "sub_frame")
    type = "SUBDOCUMENT";
  else
    type = type.toUpperCase();

  var frame = (type != "SUBDOCUMENT" ? details.frameId : details.parentFrameId);
  var filter = checkRequest(type, details.tabId, details.url, frame);
  details.requestHeaders.push({name: "DNT", value: "1"});

  if (filter instanceof BlockingFilter) {
    console.log("Filtering url " + details.url);
    return {cancel: true};
  }
  else if (filter instanceof WhitelistFilter) {
    console.log("Blocking cookies for url " + details.url);
    clobberCookieSetting();
    newHeaders = details.requestHeaders.filter(function(header) {
      return (header.name != "Cookie");
    });
    return {requestHeaders: newHeaders};
  }
  return {requestHeaders: details.requestHeaders};
}

function onHeadersReceived(details)
{
  if (details.tabId == -1)
    return;

  var type = details.type;
  if (type != "main_frame" && type != "sub_frame")
    return;

  var url = getFrameUrl(details.tabId, details.frameId);
  if (url != details.url)
    return;

  var key = null;
  var signature = null;
  for (var i = 0; i < details.responseHeaders.length; i++)
  {
    var header = details.responseHeaders[i];
    if (header.name.toLowerCase() == "x-adblock-key" && header.value)
    {
      var index = header.value.indexOf("_");
      if (index >= 0)
      {
        var key = header.value.substr(0, index);
        var signature = header.value.substr(index + 1);
        break;
      }
    }
  }
  if (!key)
    return;

  var parentUrl = null;
  if (type == "sub_frame")
    parentUrl = getFrameUrl(details.tabId, details.parentFrameId);
  if (!parentUrl)
    parentUrl = url;
  var docDomain = extractHostFromURL(parentUrl);
  var keyMatch = defaultMatcher.matchesByKey(url, key.replace(/=/g, ""), docDomain);
  if (keyMatch)
  {
    // Website specifies a key that we know but is the signature valid?
    var uri = new URI(url);
    var host = uri.asciiHost;
    if (uri.port > 0)
      host += ":" + uri.port;

    var params = [
      uri.path.replace(/#.*/, ""),  // REQUEST_URI
      host,                         // HTTP_HOST
      window.navigator.userAgent    // HTTP_USER_AGENT
    ];
    if (verifySignature(key, signature, params.join("\0")))
      frames[details.tabId][details.frameId].keyException = true;
  }
}

function recordFrame(tabId, frameId, parentFrameId, frameUrl)
{
  if (!(tabId in frames))
    frames[tabId] = {};
  frames[tabId][frameId] = {url: frameUrl, parent: parentFrameId};
}

function getFrameData(tabId, frameId)
{
  if (tabId in frames && frameId in frames[tabId])
    return frames[tabId][frameId];
  else if (frameId > 0 && tabId in frames && 0 in frames[tabId])
  {
    // We don't know anything about javascript: or data: frames, use top frame
    return frames[tabId][0];
  }
  return null;
}

function getFrameUrl(tabId, frameId)
{
  var frameData = getFrameData(tabId, frameId);
  return (frameData ? frameData.url : null);
}

function forgetTab(tabId)
{
  delete frames[tabId];
}

function checkRequest(type, tabId, url, frameId)
{
  if (isFrameWhitelisted(tabId, frameId))
    return false;

  var documentUrl = getFrameUrl(tabId, frameId);
  if (!documentUrl)
    return false;

  var requestHost = extractHostFromURL(url);
  var documentHost = extractHostFromURL(documentUrl);
  var thirdParty = isThirdParty(requestHost, documentHost);

  // dta: added more complex logic for per-subscription matchers
  // and whether to block based on them
  var spyingOrigin = false;
  // right now we only actually block based on frequency heuristic
  var frequencyBlocked = false;
  if (thirdParty && tabId > -1) {
    // used to track which methods didn't think this was a spying
    // origin, to add later if needed (we only track origins
    // that at least one blocker thinks is bad)
    var falseMatcherKeys = [ ];
    for (var matcherKey in matcherStore.combinedMatcherStore) {
      var currentMatcher = matcherStore.combinedMatcherStore[matcherKey];
      var currentFilter = currentMatcher.matchesAny(url, type, documentHost, thirdParty);
      if (currentFilter) {
        activeMatchers.addMatcherToOrigin(tabId, requestHost, matcherKey, true);
        spyingOrigin = true;
        if (matcherKey == 'frequencyHeuristic')
          frequencyBlocked = true;
      }
      else {
        falseMatcherKeys.push(matcherKey);
      }
    }
    if (spyingOrigin) {
      for (var i=0; i < falseMatcherKeys.length; i++) {
        activeMatchers.addMatcherToOrigin(tabId, requestHost, falseMatcherKeys[i], false);
      }
    }
    // only block third party requests. 
    var filter = defaultMatcher.matchesAny(url, type, documentHost, thirdParty);
    if (filter) {
      activeMatchers.addMatcherToOrigin(tabId, requestHost, "fullDefaultMatcher", true);
      if (frequencyBlocked) {
        activeMatchers.addMatcherToOrigin(tabId, requestHost, "defaultMatcher", true);
      }
    }
    else if (spyingOrigin) {
      activeMatchers.addMatcherToOrigin(tabId, requestHost, "fullDefaultMatcher", false);
      activeMatchers.addMatcherToOrigin(tabId, requestHost, "defaultMatcher", false);
    }
    return filter;
  }
  return false;
}

function isFrameWhitelisted(tabId, frameId, type)
{
  var parent = frameId;
  var parentData = getFrameData(tabId, parent);
  while (parentData)
  {
    var frame = parent;
    var frameData = parentData;

    parent = frameData.parent;
    parentData = getFrameData(tabId, parent);

    var frameUrl = frameData.url;
    var parentUrl = (parentData ? parentData.url : frameUrl);
    if ("keyException" in frameData || isWhitelisted(frameUrl, parentUrl, type))
      return true;
  }
  return false;
}
