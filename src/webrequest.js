/*
 *
 * This file is part of Privacy Badger <https://eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 * Derived from Adblock Plus 
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

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

 /* global variables */
var CookieBlockList = require("cookieblocklist").CookieBlockList;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var frames = {};
var onFilterChangeTimeout = null;
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

/* Event Listeners */
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*", "https://*/*"]}, ["requestHeaders", "blocking"]);
//chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["<all_urls>"]}, ["responseHeaders", "blocking"]);
chrome.tabs.onRemoved.addListener(onTabRemoved);
chrome.tabs.onReplaced.addListener(onTabReplaced);
FilterNotifier.addListener(onFilterNotifier);

/* functions */
function onTabRemoved(tabId){
  console.log('tab removed!', tabId);
  forgetTab(tabId);
};

function onTabUpdated(tabId, changeInfo, tab){
  console.log('tab updated', tab);
  if (changeInfo.status == "loading" && changeInfo.url != undefined){
    forgetTab(tabId);
  }
};

function onTabReplaced(addedTabId, removedTabId){
  forgetTab(removedTabId);
}

/*********************************
 * @string _mapDomain( @string domain)
 * In some cases an origin uses multiple domains which, for the purpouses of logging
 * in to the website can essentially be considered the same domain. This function maps
 * the domain that is passed in to the parent domain that is responsible.
 * **********************************/
function _mapDomain(domain){
  var domainMappings = {
    "youtube.com": 'google.com',
    "gmail.com": 'google.com',
  }
  return domainMappings[domain] || domain 
}

function tabChangesDomains(newDomain,oldDomain){
  var newDomain = _mapDomain(newDomain);
  var oldDomain = _mapDomain(oldDomain);

  return (oldDomain != newDomain);
}

function onFilterChange() {
  onFilterChangeTimeout = null;
  chrome.webRequest.handlerBehaviorChanged();
}


function onFilterNotifier(action) {
  if (action in importantNotifications) {
    // Execute delayed to prevent multiple executions in a quick succession
    if (onFilterChangeTimeout != null){
      window.clearTimeout(onFilterChangeTimeout);
    }
    onFilterChangeTimeout = window.setTimeout(onFilterChange, 2000);
  }
};

function buildCookieUrl(cookie){
  var url = "";
  if(cookie.secure){
    url += "https://";
  } else {
    url += "http://";
  }
  url += cookie.domain + cookie.path;
  return url;
}

function checkDomainOpenInTab(domain){
  for( tabId in frames ){
    if(_mappedBaseDomain(getHostForTab(tabId)) === _mappedBaseDomain(domain)){
      return true;
    }
  }
  
  return false;
}

function _mappedBaseDomain(domain){
  return domain && _mapDomain(getBaseDomain(domain));
}

function removeCookiesForDomain(domain){
  alert("removing all cookies for " + domain);
  chrome.cookies.getAll({domain: domain}, function(cookies){
    for(var i = 0; i < cookies.length; i++){
      //console.log('removing cookie for', cookies[i].domain);
      var details = {url: buildCookieUrl(cookies[i]), name: cookies[i].name, storeId: cookies[i].storeId}
      chrome.cookies.remove(details, function(details){
        //console.log('removed cookie for', details);
      });
    }
  });
}

function onBeforeRequest(details){
  if (details.tabId == -1){
    return {};
  }

  var type = details.type;
  if (type == "main_frame"){
    forgetTab(details.tabId);
  }

  if (type == "main_frame" || type == "sub_frame"){
    recordFrame(details.tabId, details.frameId, details.parentFrameId, details.url);
  }

  // Type names match Mozilla's with main_frame and sub_frame being the only exceptions.
  if (type == "sub_frame"){
    type = "SUBDOCUMENT";
  } else {
    type = type.toUpperCase();
  }
  var frame = (type != "SUBDOCUMENT" ? details.frameId : details.parentFrameId);
  var requestAction = checkRequest(type, details.tabId, details.url, frame);
  if (requestAction && Utils.isPrivacyBadgerEnabled(getHostForTab(details.tabId))) {
    //add domain to list of blocked domains if it is not there already
    if(requestAction == "block" || requestAction == "cookieBlock"){
      BlockedDomainList.addDomain(extractHostFromURL(details.url));
    }

    if (requestAction == "block" || requestAction == "userblock") {
      return {cancel: true};
    }
  }

}

function getHostForTab(tabId){
  var mainFrameIdx = 0;
  if(!frames[tabId]){
    return undefined;
  }
  if(_isTabAnExtension(tabId)){
    //if the tab is an extension get the url of the first frame for its implied URL 
    //since the url of frame 0 will be the hash of the extension key
    mainFrameIdx = Object.keys(frames[tabId])[1] || 0;
  }
  if(!frames[tabId][mainFrameIdx]){
    return undefined;
  }
  return extractHostFromURL(frames[tabId][mainFrameIdx].url);
}

function onBeforeSendHeaders(details) {
  if (details.tabId == -1){
    return {};
  }

  if(_isTabChromeInternal(details.tabId)){
    return {};
  }

  var type = details.type;

  // Type names match Mozilla's with main_frame and sub_frame being the only exceptions.
  if (type == "sub_frame"){
    type = "SUBDOCUMENT";
  } else {
    type = type.toUpperCase();
  }
  var frame = (type != "SUBDOCUMENT" ? details.frameId : details.parentFrameId);
  var requestAction = checkRequest(type, details.tabId, details.url, frame);
  //console.log("REQUEST ACTION:", requestAction, type, details.tabId, details.url, frame);
  if (requestAction && Utils.isPrivacyBadgerEnabled(getHostForTab(details.tabId))) {
    if (requestAction == "cookieblock" || requestAction == "usercookieblock") {
      newHeaders = details.requestHeaders.filter(function(header) {
        return (header.name.toLowerCase() != "cookie" && header.name.toLowerCase() != "referer");
      });
      newHeaders.push({name: "DNT", value: "1"});
      return {requestHeaders: newHeaders};
    }
  }
  
  // Still sending Do Not Track even if HTTP and cookie blocking are disabled
  details.requestHeaders.push({name: "DNT", value: "1"});
  return {requestHeaders: details.requestHeaders};
}

function onHeadersReceived(details){
  if (details.tabId == -1){
    return {};
  }

  var type = details.type;

  // Type names match Mozilla's with main_frame and sub_frame being the only exceptions.
  if (type == "sub_frame"){
    type = "SUBDOCUMENT";
  } else {
    type = type.toUpperCase();
  }

  var frame = (type != "SUBDOCUMENT" ? details.frameId : details.parentFrameId);
  var requestAction = checkRequest(type, details.tabId, details.url, frame);
  console.log("REQUEST ACTION:", requestAction, type, details.tabId, details.url, frame);
  if (requestAction && Utils.isPrivacyBadgerEnabled(getHostForTab(details.tabId))) {
    if (requestAction == "cookieblock" || requestAction == "usercookieblock") {
      var newHeaders = details.responseHeaders.filter(function(header) {
        return (header.name.toLowerCase() != "set-cookie");
      });
      newHeaders.push({name:'x-marks-the-spot', value:'foo'});
      //TODO don't return this unless we modified headers
      return {responseHeaders: newHeaders};
    }
  }
}

function recordFrame(tabId, frameId, parentFrameId, frameUrl) {
  if (frames[tabId] == undefined){
    frames[tabId] = {};
  }
  frames[tabId][frameId] = {url: frameUrl, parent: parentFrameId};
}

function getFrameData(tabId, frameId) {
  if (tabId in frames && frameId in frames[tabId]){
    return frames[tabId][frameId];
  } else if (frameId > 0 && tabId in frames && 0 in frames[tabId]) {
    // We don't know anything about javascript: or data: frames, use top frame
    return frames[tabId][0];
  }
  return null;
}

function getFrameUrl(tabId, frameId) {
  var frameData = getFrameData(tabId, frameId);
  return (frameData ? frameData.url : null);
}

function forgetTab(tabId) {
  console.log('forgetting tab', tabId);
  activeMatchers.removeTab(tabId)
  delete frames[tabId];
}

function checkAction(tabId, url){
  //ignore requests coming from internal chrome tabs
  if(_isTabChromeInternal(tabId) ){
    return false;
  }

  var documentUrl = getFrameUrl(tabId, 0);
  if (!documentUrl){
    return false;
  }

  var requestHost = url;
  var documentHost = extractHostFromURL(documentUrl);
  var thirdParty = isThirdParty(requestHost, documentHost);

  if (thirdParty && tabId > -1) {
    return getAction(tabId, requestHost);
  }
  return false;
}

function checkRequest(type, tabId, url, frameId) {
  if (isFrameWhitelisted(tabId, frameId)){
    return false;
  }

  //ignore requests coming from internal chrome tabs
  if(_isTabChromeInternal(tabId) ){
    return false;
  }

  var documentUrl = getFrameUrl(tabId, 0);
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
      // if the third party origin is not blocked we add it to the list to 
      // inform the user of all third parties on the page.
      //activeMatchers.addMatcherToOrigin(tabId, requestHost, false, false);
      return "noaction";
    }
    //console.log("Subscription data for " + requestHost + " is: " + JSON.stringify(blockedData[requestHost]));
    var action = activeMatchers.getAction(tabId, requestHost);
    if (action && action != 'noaction'){
      //console.log("Action to be taken for " + requestHost + ": " + action);
    }
    return action;
  }
  return false;
}

function _frameUrlStartsWith(tabId, piece){
  return frames[tabId] &&
    frames[tabId][0] &&
    (frames[tabId][0].url.indexOf(piece) === 0);
}

function _isTabChromeInternal(tabId){
  return _frameUrlStartsWith(tabId, "chrome");
}

function _isTabAnExtension(tabId){
  return _frameUrlStartsWith(tabId, "chrome-extension://");
}

function isFrameWhitelisted(tabId, frameId, type) {
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
    if ("keyException" in frameData || isWhitelisted(frameUrl, parentUrl, type)){
      return true;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
  var tabHost  = extractHostFromURL(sender.tab.url);
    if(request.checkLocation && Utils.isPrivacyBadgerEnabled(tabHost)){ 
      var documentHost = request.checkLocation.hostname;
      var reqAction = checkRequest('SUBDOCUMENT', sender.tab.id, documentHost,0);
      var cookieBlock = reqAction == 'cookieblock' || reqAction == 'usercookieblock';
      sendResponse(cookieBlock);
    }
  }
);
