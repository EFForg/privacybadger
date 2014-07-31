/*
 *
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
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
var DomainExceptions = require("domainExceptions").DomainExceptions;
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
var backgroundPage = chrome.extension.getBackgroundPage();
var imports = ["saveAction", "getHostForTab"];
for (var i = 0; i < imports.length; i++){
  window[imports[i]] = backgroundPage[imports[i]];
}
var temporarySocialWidgetUnblock = {};

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

  var requestAction = checkAction(details.tabId, details.url, false, details.frameId);
  if (requestAction && Utils.isPrivacyBadgerEnabled(getHostForTab(details.tabId))) {
    //add domain to list of blocked domains if it is not there already
    if(requestAction == "block" || requestAction == "cookieblock"){
      BlockedDomainList.addDomain(extractHostFromURL(details.url));

      //if settings for this domain are still controlled by badger and it is in 
      //the list of domain exceptions ask the user if they would like to unblock.
      if(requestAction.indexOf('user') < 0){
        var whitelistAry = DomainExceptions.getWhitelistForPath(details.url);
        if( whitelistAry){
          _askUserToWhitelist(details.tabId, whitelistAry['whitelist_urls'], whitelistAry['english_name'])
        }
      }

    }

    if (requestAction == "block" || requestAction == "userblock") {
      // Notify the content script...
      var msg = {
        "replaceSocialWidget" : true,
	"trackerDomain" : extractHostFromURL(details.url)
      };
      chrome.tabs.sendMessage(details.tabId, msg);

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

  var requestAction = checkAction(details.tabId, details.url, false, details.frameId);
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

  var requestAction = checkAction(details.tabId, details.url, false, details.frameId);
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
  delete temporarySocialWidgetUnblock[tabId];
}

function checkAction(tabId, url, quiet, frameId){
  var action = false;

  //ignore requests coming from temporary unblocked social widget
  //(aka someone has clicked on the widget, so let it load)
  if (isSocialWidgetTemporaryUnblock(tabId, url, frameId)) {
    return false;
  }

  //ignore requests coming from internal chrome tabs
  if(_isTabChromeInternal(tabId) ){
    return action;
  }

  //ignore requests that don't have a document url for some reason
  var documentUrl = getFrameUrl(tabId, 0);
  if (!documentUrl){
    return action;
  }

  var requestHost = extractHostFromURL(url);
  var documentHost = extractHostFromURL(documentUrl);
  var origin = getBaseDomain(requestHost);
  var thirdParty = isThirdParty(requestHost, documentHost);

  if (thirdParty && tabId > -1) {
    action = activeMatchers.getAction(tabId, requestHost);
    if(!action && httpRequestOriginFrequency[origin]) {
      action = "noaction"
    }
  }
  if(action && !quiet){
    activeMatchers.addMatcherToOrigin(tabId, requestHost, "requestAction", action);
  }
  return action;
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

function _askUserToWhitelist(tabId, whitelistDomains, englishName){
  console.log('assking user to whitelist');
  var port = chrome.tabs.connect(tabId);
  port.postMessage({action: 'attemptWhitelist', whitelistDomain:englishName, currentDomain:getHostForTab(tabId)});
  port.onMessage.addListener(function(msg){
    for(var i = 0; i < whitelistDomains.length; i++){
      if(msg.action === "allow_all"){
        saveAction('noaction', whitelistDomains[i]);
        reloadTab(tabId);
      } 
      if(msg.action === "allow_once"){
        //allow blag on this site only
        saveAction('noaction', whitelistDomains[i], getHostForTab(tabId));
        reloadTab(tabId);
      }
      if(msg.action === "never"){
        //block third party domain always
        console.log('never allow');
        saveAction('cookieblock', whitelistDomains[i]);
        reloadTab(tabId);
      }
      if(msg.action === "not_now"){
        //do nothing
      }
    }
  });
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

// Provides the social widget blocking content script with list of social widgets to block
function getSocialWidgetBlockList(tabId) {

  // a mapping of individual SocialWidget objects to boolean values
  // saying if the content script should replace that tracker's buttons
  var socialWidgetsToReplace = {};

  SocialWidgetList.forEach(function(socialwidget) {
    var socialWidgetName = socialwidget.name;

    // replace them if PrivacyBadger has blocked them
    var blockedData = activeMatchers.blockedOriginsByTab[tabId];
    if (blockedData && blockedData[socialwidget.domain]) {
      socialWidgetsToReplace[socialWidgetName] = (blockedData[socialwidget.domain].latestaction == "block"
	      					  || blockedData[socialwidget.domain].latestaction == "userblock");
    }
    else {
      socialWidgetsToReplace[socialWidgetName] = false;
    }
  });

  return {
    "trackers" : SocialWidgetList,
    "trackerButtonsToReplace" : socialWidgetsToReplace,
  };
}

// Check if tab is temporarily unblocked for tracker
function isSocialWidgetTemporaryUnblock(tabId, url, frameId) {
  var exceptions = temporarySocialWidgetUnblock[tabId];
  if (exceptions == undefined) {
    return false;
  }

  var requestHost = extractHostFromURL(url);
  var requestExcept = (exceptions.indexOf(requestHost) != -1);

  var frameHost = extractHostFromURL(getFrameUrl(tabId, frameId));
  var frameExcept = (exceptions.indexOf(frameHost) != -1);

  //console.log((requestExcept || frameExcept) + " : exception for " + url);

  return (requestExcept || frameExcept);
}

// Unblocks a tracker just temporarily on this tab, because the user has clicked the
// corresponding replacement social widget.
function unblockSocialWidgetOnTab(tabId, socialWidgetUrls) {
  if (temporarySocialWidgetUnblock[tabId] == undefined){
    temporarySocialWidgetUnblock[tabId] = [];
  }
  for (var i in socialWidgetUrls) {
    var socialWidgetUrl = socialWidgetUrls[i];
    var socialWidgetHost = extractHostFromURL(socialWidgetUrl);
    temporarySocialWidgetUnblock[tabId].push(socialWidgetHost);
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    var tabHost  = extractHostFromURL(sender.tab.url);
    if(request.checkLocation && Utils.isPrivacyBadgerEnabled(tabHost)){
      var documentHost = request.checkLocation.href;
      var reqAction = checkAction(sender.tab.id, documentHost, true);
      var cookieBlock = reqAction == 'cookieblock' || reqAction == 'usercookieblock';
      sendResponse(cookieBlock);
    }
    if(request.checkReplaceButton && Utils.isPrivacyBadgerEnabled(tabHost) && Utils.isSocialWidgetReplacementEnabled()){
      var socialWidgetBlockList = getSocialWidgetBlockList(sender.tab.id);
      sendResponse(socialWidgetBlockList);
    }
    if(request.unblockSocialWidget){
      var socialWidgetUrls = request.buttonUrls;
      unblockSocialWidgetOnTab(sender.tab.id, socialWidgetUrls);
      sendResponse();
    }
  }
);
