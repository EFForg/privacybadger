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
var FakeCookieStore = require("fakecookiestore").FakeCookieStore;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var frames = {};
var clobberRequestIds = {};
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
chrome.cookies.onChanged.addListener(onCookieChanged);
chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.tabs.onRemoved.addListener(onTabRemoved);
FilterNotifier.addListener(onFilterNotifier);

/* functions */
function onTabRemoved(tabId){
  console.log('tab removed!');
  var baseDomain = getBaseDomain(extractHostFromURL(getFrameUrl(tabId, 0)));
  var mappedDomain = _mapDomain(baseDomain);
  forgetTab(tabId);
  if(Utils.isPrivacyBadgerEnabled()){
    if(!checkDomainOpenInTab(baseDomain)){
      console.log(baseDomain, 'is not open in any tab, so removing cookies');
      removeCookiesIfCookieBlocked(baseDomain);
    }
    if(!checkDomainOpenInTab(mappedDomain)){
      console.log(mappedDomain, 'is not open in any tab, so removing cookies');
      removeCookiesIfCookieBlocked(mappedDomain);
    }
  }
};

function onTabUpdated(tabId, changeInfo, tab){
  if (changeInfo.status == "loading" && changeInfo.url != undefined){
    console.log('tab changed to', changeInfo.url);
    //if the change in the tab is within the same domain we don't want to remove the cookies
    forgetTab(tabId);
    recordFrame(tabId,0,-1,changeInfo.url);
  }
};

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

function onCookieChanged(changeInfo){
  var cookieDomain = getBaseDomain(changeInfo.cookie.domain);
  var cookie = changeInfo.cookie;

  if(changeInfo.removed){
    if(changeInfo.cause == 'explicit'){
      //if we are removing a cookie via the api then we don't need to do anything!
      return;
    } else {
      if(FakeCookieStore.cookies[cookieDomain]) {
        console.log('removing cookies for', cookieDomain, 'from fake cookie store');
        FakeCookieStore.removeCookie(cookieDomain, cookie.name);
      }
    }
  }

  // we check against the base domain because its okay for a site to set cookies for .example.com or www.example.com
  if(CookieBlockList.hasBaseDomain(cookieDomain) && Utils.isPrivacyBadgerEnabled()){
    //likely a tab change caused this so wait until a little bit in the future to make sure the domain is still open to prevent a race condition
    setTimeout(function(){
      if(!checkDomainOpenInTab(cookieDomain)){
        console.log('!!! removing cookies for domain from real cookie store',cookieDomain);
        chrome.cookies.remove({url: buildCookieUrl(cookie), name:cookie.name});
      }
    }, 1000);
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

function addCookiesToRealCookieStore(cookies){
  for(i in cookies){
    var cookie = cookies[i];
    cookie.url = buildCookieUrl(cookie);
    if(cookie.hostOnly){
      delete cookie.domain;
    }
    delete cookie.hostOnly;
    delete cookie.session;
    chrome.cookies.set(cookie);
  }
}

function removeCookiesForDomain(domain){
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

  if (type == "main_frame" && Utils.isPrivacyBadgerEnabled()){
    var newDomain = getBaseDomain(extractHostFromURL(details.url));
    var oldDomain = getBaseDomain(extractHostFromURL(getFrameUrl(details.tabId, 0)));
    var mappedDomain = _mapDomain(oldDomain);
    var fakeCookies = FakeCookieStore.getCookies(newDomain);
    var mappedCookies = FakeCookieStore.getCookies(_mapDomain(newDomain));

    forgetTab(details.tabId);
    
    if(tabChangesDomains(newDomain,oldDomain)){ 
      console.log('TAB CHANGED DOMAINS', oldDomain, newDomain);
      if(!checkDomainOpenInTab(oldDomain)){
        console.log('REMOVING COOKIES BECAUSE OF DOMAIN CHANGE FOR TAB', oldDomain);
        removeCookiesIfCookieBlocked(oldDomain);
      }
      if(!checkDomainOpenInTab(mappedDomain)){
        removeCookiesIfCookieBlocked(mappedDomain);
      }
    }

    if(!checkDomainOpenInTab(newDomain)){
      addCookiesToRealCookieStore(fakeCookies);
      addCookiesToRealCookieStore(mappedCookies);
    }
  }

  if (type == "main_frame" || type == "sub_frame"){
    recordFrame(details.tabId, details.frameId, details.parentFrameId, details.url);
  }

  //for an extension we try to load cookies for the domain that the extension
  //actually cares about
  if(_isTabAnExtension(details.tabId)){
    var domain = _mappedBaseDomain(getHostForTab(details.tabId))
    chrome.cookies.getAll({domain: domain}, function(cookies){
      if(cookies.length === 0){
        var fakeCookies = FakeCookieStore.getCookies(domain);
        addCookiesToRealCookieStore(fakeCookies);
      }
    });
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

  var type = details.type;

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
    else if (requestAction == "cookieblock" || requestAction == "usercookieblock") {
      recordRequestId(details.requestId);
      //CookieBlockList.addDomain(extractHostFromURL(details.url));
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

function recordFrame(tabId, frameId, parentFrameId, frameUrl) {
  if (frames[tabId] == undefined){
    frames[tabId] = {};
  }
  frames[tabId][frameId] = {url: frameUrl, parent: parentFrameId};
}

function recordRequestId(requestId) {
  clobberRequestIds[requestId] = true;
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
  activeMatchers.removeTab(tabId)
  delete frames[tabId];
}

function removeCookiesIfCookieBlocked(baseDomain){
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

  //ignore requests coming from internal chrome tabs
  if(_isTabChromeInternal(tabId) ){
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
      // if the third party origin is not blocked we add it to the list to 
      // inform the user of all third parties on the page.
     // activeMatchers.addMatcherToOrigin(tabId, requestHost, false, false);
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
