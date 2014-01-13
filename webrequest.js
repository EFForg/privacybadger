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
chrome.webRequest.onCompleted.addListener(onCompleted, {urls: ["http://*/*", "https://*/*"]});

chrome.tabs.onRemoved.addListener(forgetTab);

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
  if (changeInfo.status == "loading" && changeInfo.url != undefined){
    forgetTab(tabId);
    recordFrame(tabId,0,-1,changeInfo.url);
  }
});

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
var clobberRequestIds = {};

function onCompleted(details)
{
  if (details.requestId in clobberRequestIds) {
    chrome.tabs.executeScript(details.tabId, {file: "clobbercookie.js", runAt: "document_start"});
    delete clobberRequestIds[details.requestId];
  }
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
  var requestAction = checkRequest(type, details.tabId, details.url, frame);
  if (requestAction && localStorage.enabled == "true") {
    if (requestAction == "block" || requestAction == "userblock") {
      return {cancel: true};
    }
    else if (requestAction == "cookieblock" || requestAction == "usercookieblock") {
      recordRequestId(details.requestId);
      //clobberCookieSetting();
      newHeaders = details.requestHeaders.filter(function(header) {
        return (header.name != "Cookie" && header.name != "Referer");
      });
      newHeaders.push({name: "DNT", value: "1"});
      return {requestHeaders: newHeaders};
    }
  }
  
  // Still sending Do Not Track even if HTTP and cookie blocking are disabled
  details.requestHeaders.push({name: "DNT", value: "1"});
  return {requestHeaders: details.requestHeaders};
}

function recordFrame(tabId, frameId, parentFrameId, frameUrl)
{
  if (frames[tabId] == undefined){
    frames[tabId] = {};
  }
  frames[tabId][frameId] = {url: frameUrl, parent: parentFrameId};
}

function recordRequestId(requestId) {
  clobberRequestIds[requestId] = true;
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
  activeMatchers.removeTab(tabId)
  delete frames[tabId];
}

function clobberCookieSetting() {
  var dummyCookie = "";
  Object.defineProperty(document, "cookie", {
    __proto__: null,
    configurable: false,
    get: function () {
      return dummyCookie;
    },
    set: function (newValue) {
      dummyCookie = newValue;
    }
  });
}

function checkRequest(type, tabId, url, frameId) {
  if (isFrameWhitelisted(tabId, frameId)){
    return false;
  }

  var documentUrl = getFrameUrl(tabId, frameId);
  if (!documentUrl){
    return false;
}

  var requestHost = extractHostFromURL(url);
  var documentHost = extractHostFromURL(documentUrl);
  var thirdParty = isThirdParty(requestHost, documentHost);
  // dta: added more complex logic for per-subscription matchers
  // and whether to block based on them
  // todo: DRY; this code was moved to activeMatchers class in matcher.js
  var spyingOrigin = false;
  if (thirdParty && tabId > -1) {
    // used to track which methods didn't think this was a spying
    // origin, to add later if needed (we only track origins
    // that at least one subscription list matches)
    var unfiredMatchers = [ ];
    for (var matcherKey in matcherStore.combinedMatcherStore) {
      var currentMatcher = matcherStore.combinedMatcherStore[matcherKey];
      var currentFilter = currentMatcher.matchesAny(url, type, documentHost, thirdParty);
      if (currentFilter) {
        activeMatchers.addMatcherToOrigin(tabId, requestHost, matcherKey, true);
        spyingOrigin = true;
      } else {
        unfiredMatchers.push(matcherKey);
      }
    }
    if (spyingOrigin) {
      // make sure to set the document host
      // todo: there may be a race condition here if a user tries to alter settings while
      // this code is executing
      activeMatchers.setDocumentHost(tabId, documentHost);
      for (var i=0; i < unfiredMatchers.length; i++) {
        activeMatchers.addMatcherToOrigin(tabId, requestHost, unfiredMatchers[i], false);
      }
    } 
    // determine action
    if (!activeMatchers.getTabData(tabId)) {
      return "noaction";
    }
    var blockedData = activeMatchers.blockedOriginsByTab[tabId];
    var blockedDataByHost = blockedData[requestHost];
    if (!(blockedDataByHost)){
      /*// if the third party origin is not blocked we add it to the list to 
      // inform the user of all trackers.
      activeMatchers.addMatcherToOrigin(tabId, requestHost, false, false);*/
      return "noaction";
    }
    //console.log("Subscription data for " + requestHost + " is: " + JSON.stringify(blockedData[requestHost]));
    var action = activeMatchers.getAction(tabId, requestHost);
    if (action && action != 'noaction'){
      console.log("Action to be taken for " + requestHost + ": " + action);
    }
    return action;
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
