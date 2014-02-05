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
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
//chrome.webRequest.onCompleted.addListener(onCompleted, {urls: ["http://*/*", "https://*/*"]});

chrome.tabs.onRemoved.addListener(function(tabId){
  removeCookiesIfCookieBlocked(tabId);
  forgetTab(tabId);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
  if (changeInfo.status == "loading" && changeInfo.url != undefined){
    //if the change in the tab is within the same domain we don't want to remove the cookies
    forgetTab(tabId);
    recordFrame(tabId,0,-1,changeInfo.url);
  }
});

function tabChangesDomains(tabId,newUrl){
  var baseDomain = getBaseDomain(extractHostFromURL(getFrameUrl(tabId, 0)));
  if(!baseDomain){
    return false;
  }
  var newDomain = getBaseDomain(extractHostFromURL(newUrl));
  if(baseDomain == newDomain){
    return false;
  }
  return true;
}

chrome.cookies.onChanged.addListener(onCookieChanged);

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

var CookieBlockList = require("cookieblocklist").CookieBlockList
var FakeCookieStore = require("fakecookiestore").FakeCookieStore

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

/*function onCompleted(details)
{
  if (details.requestId in clobberRequestIds) {
    chrome.tabs.executeScript(details.tabId, {file: "clobbercookie.js", runAt: "document_start"});
    delete clobberRequestIds[details.requestId];
  }
}*/

function onCookieChanged(changeInfo){
  //if we are removing a cookie then we don't need to do anything!
  if(changeInfo.removed && changeInfo.cause == 'explicit'){
    console.log('explicit so not removing cookie for', changeInfo.cookie.domain);
    return;
  }

  // we check against the base domain because its okay for a site to set cookies for .example.com or www.example.com
  //console.log('on cookie added/ changed');
  var cookieDomain = getBaseDomain(changeInfo.cookie.domain);
  var cookie = changeInfo.cookie;
  

  if(CookieBlockList.hasBaseDomain(cookieDomain)){
    if(!checkDomainOpenInTab(cookieDomain)){
      console.log('removing cookies for domain from real cookie store',cookieDomain);
      chrome.cookies.remove({url: buildCookieUrl(cookie), name:cookie.name});
    }
  }

}

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
  for(idx in frames){
    if(frames[idx][0] && 
      getBaseDomain(extractHostFromURL(frames[idx][0].url)) == domain){
      return true;
    }
  }
  return false;
}
function addCookiesToRealCookieStore(cookies){
  for(i in cookies){
    console.log('re-adding cookie for', cookies[i].domain);
    var cookie = cookies[i];
    delete cookie.hostOnly;
    delete cookie.session;
    cookie.url = buildCookieUrl(cookie);
    chrome.cookies.set(cookie);
  }
}

function removeCookiesForDomain(domain){
  chrome.cookies.getAll({domain: domain}, function(cookies){
    for(var i = 0; i < cookies.length; i++){
      console.log('removing cookie for', cookies[i].domain);
      var details = {url: buildCookieUrl(cookies[i]), name: cookies[i].name, storeId: cookies[i].storeId}
      chrome.cookies.remove(details, function(details){
        console.log('removed cookie for', details);
      });
    }
  });
}

function onBeforeRequest(details){
  if (details.tabId == -1)
    return {};

  var type = details.type;

  if (type == "main_frame"){
    if(tabChangesDomains(details.tabId,details.url)){ 
      console.log('tab changed domains!');
      removeCookiesIfCookieBlocked(details.tabId);
    } 
    recordFrame(details.tabId,0,-1,details.url);

    var domain = getBaseDomain(extractHostFromURL(details.url));
    var fakeCookies = FakeCookieStore.getCookies(domain);

    chrome.cookies.getAll({domain: domain}, function(cookies){
      if(!cookies || !cookies.length > 0){
        addCookiesToRealCookieStore(fakeCookies);
      }
    });
  }
}

function onBeforeSendHeaders(details)
{
  if (details.tabId == -1)
    return {};

  var type = details.type;
  /*if (type == "main_frame"){
  }*/

  if (type == "main_frame" || type == "sub_frame"){
    recordFrame(details.tabId, details.frameId, details.parentFrameId, details.url);
  }


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
      CookieBlockList.addDomain(extractHostFromURL(details.url));
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

function forgetTab(tabId) {
  activeMatchers.removeTab(tabId)
  delete frames[tabId];
}

function removeCookiesIfCookieBlocked(tabId){
  var baseDomain = getBaseDomain(extractHostFromURL(getFrameUrl(tabId, 0)));
  console.log('thinking about removing cookies for', baseDomain, CookieBlockList.hasBaseDomain(baseDomain));
  if(CookieBlockList.hasBaseDomain(baseDomain)){
    chrome.cookies.getAll({domain: baseDomain}, function(cookies){
      FakeCookieStore.setCookies(baseDomain, cookies);
      removeCookiesForDomain(baseDomain);
    });
  };
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
      //console.log("Action to be taken for " + requestHost + ": " + action);
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
