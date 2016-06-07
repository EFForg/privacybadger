/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 *
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
 /*jshint unused:false*/

// TODO: Encapsulate code and replace window.* calls throught code with pb.*

var utils = require("utils");
var DomainExceptions = require("domainExceptions").DomainExceptions;
var HeuristicBlocking = require("heuristicblocking");
var SocialWidgetLoader = require("socialwidgetloader");
var pbStorage = require("storage");
var webrequest = require("webrequest");
var SocialWidgetList = SocialWidgetLoader.loadSocialWidgetsFromFile("src/socialwidgets.json");
var Migrations = require("migrations").Migrations;
var incognito = require("incognito");


// Display debug messages
DEBUG = false,

constants = { // duplicated in pb.prototype, remove those eventually
  // Tracking status constants
  NO_TRACKING: "noaction",
  ALLOW: "allow",
  BLOCK: "block",
  COOKIEBLOCK: "cookieblock",
  DNT: "dnt",
  USER_ALLOW: "user_allow",
  USER_BLOCK: "user_block",
  USER_COOKIE_BLOCK: "user_cookieblock",

  // URLS
  DNT_POLICIES_URL: "https://www.eff.org/files/dnt-policies.json",
  COOKIE_BLOCK_LIST_URL: "https://www.eff.org/files/cookieblocklist_new.txt",

  // The number of 1st parties a 3rd party can be seen on
  TRACKING_THRESHOLD: 3,
  MAX_COOKIE_ENTROPY: 12,
}

/**
* privacy badger initializer
*/
function  Badger(tabData, isIncognito) {
    this.isIncognito = isIncognito
    this.tabData = JSON.parse(JSON.stringify(tabData));
    var badger = this;
    this.storage = new pbStorage.BadgerPen(isIncognito, function(thisStorage) {
        if(badger.INITIALIZED) { return; }
        badger.utils = new utils.Utils(badger);
        badger.heuristicBlocking = new HeuristicBlocking.HeuristicBlocker(badger.utils, thisStorage);
        badger.updateTabList();
        badger.initializeDefaultSettings();
        try {
          badger.runMigrations();
        } finally {
          badger.initializeCookieBlockList();
          badger.initializeDNT();
          badger.showFirstRunPage();
        }

        // Show icon as page action for all tabs that already exist
        chrome.windows.getAll({populate: true}, function(windows) {
          for (var i = 0; i < windows.length; i++) {
            for (var j = 0; j < windows[i].tabs.length; j++) {
              refreshIconAndContextMenu(windows[i].tabs[j]);
            }
          }
        });

        // TODO: register all privacy badger listeners here in the storage callback

        badger.INITIALIZED = true;
        console.log('privacy badger is ready to rock');
        console.log('set pb.DEBUG=1 to view console messages');
    });
}

Badger.prototype = {
  // imports
  webrequest: webrequest,

  // Tracking status constants
  NO_TRACKING: "noaction",
  ALLOW: "allow",
  BLOCK: "block",
  COOKIEBLOCK: "cookieblock",
  DNT: "dnt",
  USER_ALLOW: "user_allow",
  USER_BLOCK: "user_block",
  USER_COOKIE_BLOCK: "user_cookieblock",

  // URLS
  DNT_POLICIES_URL: "https://www.eff.org/files/dnt-policies.json",
  COOKIE_BLOCK_LIST_URL: "https://www.eff.org/files/cookieblocklist_new.txt",

  // The number of 1st parties a 3rd party can be seen on
  TRACKING_THRESHOLD: 3,
  MAX_COOKIE_ENTROPY: 12,

  INITIALIZED: false,

  /**
  * Per-tab data that gets cleaned up on tab closing
    looks like:
      tabData = {
        <tab_id>: {
          fpData: {
            <script_origin>: {
              canvas: {
                fingerprinting: boolean,
                write: boolean
              }
            },
            ...
          },
          frames: {
            <frame_id>: {
              url: string,
              parent: int
            },
            ...
          },
          trackers: {
            domain.tld: bool
            ...
          }
        },
        ...
      }
  */
  tabData: {},


  // Methods

  showFirstRunPage: function(){
    var settings = this.storage.getBadgerStorageObject("settings_map");
    if (settings.getItem("isFirstRun") && !chrome.extension.inIncognitoContext) {
      chrome.tabs.create({
        url: chrome.extension.getURL("/skin/firstRun.html")
      });
      settings.setItem("isFirstRun", false);
    }
  },

  /**
  * saves a user preference for an origin, overriding
  * the default setting.
  * @param {String} userAction enum of block, cookieblock, noaction
  * @param {String} origin the third party origin to take action on
  */
  saveAction: function(userAction, origin) {
    var allUserActions = {'block': this.USER_BLOCK,
                          'cookieblock': this.USER_COOKIE_BLOCK,
                          'allow': this.USER_ALLOW};
    this.storage.setupUserAction(origin, allUserActions[userAction]);
    log("Finished saving action " + userAction + " for " + origin);

    // TODO: right now we don't determine whether a reload is needed
    return true;
  },


  /**
  * Populate tabs object with currently open tabs when extension is updated or installed.
  */
  updateTabList: function(){
    // Initialize the tabData/frames object if it is falsey
    this.tabData = this.tabData || {};
    thesetabs = this.tabData
    chrome.tabs.query({currentWindow: true, status: 'complete'}, function(tabs){
      for(var i = 0; i < tabs.length; i++){
        var tab = tabs[i];
        thesetabs[tab.id] = {
          frames: {
            0: {
              parent: -1,
              url: tab.url
            }
          },
          trackers: {}
        };
      }
    });
  },

  /**
   * Initialize the Cookieblock List:
   * * Download list form eff
   * * Merge with existing cookieblock list if any
   * * Add any new domains to the action map
   * Set a timer to update every 24 hours
   **/
  initializeCookieBlockList: function(){
    this.updateCookieBlockList();
    setInterval(this.updateCookieBlockList, this.utils.oneDay());
  },

  /**
  * Update the cookie block list with a new list
  * add any new entries that already have a parent domain in the action_map
  * and remove any old entries that are no longer in the cookie block list
  * from the action map
  **/
  updateCookieBlockList: function(){
    var thisStorage = this.storage;
    utils.xhrRequest(constants.COOKIE_BLOCK_LIST_URL, function(err,response){
      if(err){
        console.error('Problem fetching privacy badger policy hash list at',
                  constants.COOKIE_BLOCK_LIST_URL, err.status, err.message);
        return;
      }
      var cookieblock_list = thisStorage.getBadgerStorageObject('cookieblock_list');
      var action_map = thisStorage.getBadgerStorageObject('action_map');

      var newCbDomains = _.map(response.split("\n"), function(d){ return d.trim();});
      var oldCbDomains = Object.keys(cookieblock_list.getItemClones());

      var addedDomains = _.difference(newCbDomains, oldCbDomains);
      var removedDomains = _.difference(oldCbDomains, newCbDomains);
      log('adding to cookie blocklist:', addedDomains);
      log('removing from cookie blocklist:', removedDomains);

      // Change any removed domains back to blocked status
      _.each(removedDomains, function(domain){
        cookieblock_list.deleteItem(domain);
        if(action_map.hasItem(domain)){
          thisStorage.setupHeuristicAction(domain, constants.BLOCK);
        }
        var rmvdSubdomains = _.filter(Object.keys(action_map.getItemClones()),
                                  function(subdomain){
                                    return subdomain.endsWith(domain);
                                  });
        _.each(removedDomains, function(domain){
          thisStorage.setupHeuristicAction(domain, constants.BLOCK);
        });
      });

      // Add any new cookie block domains who's parent domain is already blocked
      _.each(addedDomains, function(domain){
        cookieblock_list.setItem(domain, true);
        var baseDomain = window.getBaseDomain(domain);
        if(action_map.hasItem(baseDomain) &&
           _.contains([constants.BLOCK, constants.COOKIEBLOCK],
                      action_map.getItem(baseDomain).heuristicAction)){
          thisStorage.setupHeuristicAction(domain, constants.COOKIEBLOCK);
        }
      });

    });
  },

  /**
  * Initialize DNT Setup:
  * * download acceptable hashes from EFF
  * * set up listener to recheck blocked domains and DNT domains
  */
  initializeDNT: function(){
    this.updateDNTPolicyHashes();
    this.recheckDNTPolicyForDomains();
    setInterval(this.recheckDNTPolicyForDomains, this.utils.oneHour());
    setInterval(this.updateDNTPolicyHashes, this.utils.oneDay() * 4);
  },

  /**
  * Fetch acceptable DNT policy hashes from the EFF server
  */
  updateDNTPolicyHashes: function(){
    var thisStorage = this.storage
    utils.xhrRequest(this.DNT_POLICIES_URL, function(err,response){
      if(err){
        console.error('Problem fetching privacy badger policy hash list at',
                 this.DNT_POLICIES_URL, err.status, err.message);
        return;
      }
      thisStorage.updateDNTHashes(JSON.parse(response));
    });
  },



  /**
  * Loop through all known domains and recheck any that need to be rechecked for a dnt-policy file
  */
  recheckDNTPolicyForDomains: function(){
    var action_map = this.storage.getBadgerStorageObject('action_map');
    for(var domain in action_map.getItemClones()){
      this.checkForDNTPolicy(domain, this.storage.getNextUpdateForDomain(domain));
    }
  },


  /**
  * Check a domain for a DNT policy and unblock it if it has one
  * @param {String} domain The domain to check
  * @param {timestamp} nextUpdate time when the DNT policy should be rechecked
  */
  checkForDNTPolicy: function(domain, nextUpdate){
    if(Date.now() < nextUpdate){ return; }
    log('Checking', domain, 'for DNT policy.');
    var badger = this;

    this.checkPrivacyBadgerPolicy(domain, function(success){
      if(success){
        log('It looks like', domain, 'has adopted Do Not Track! I am going to unblock them');
        badger.storage.setupDNT(domain);
      } else {
        log('It looks like', domain, 'has NOT adopted Do Not Track');
        badger.storage.revertDNT(domain);
      }
      badger.storage.touchDNTRecheckTime(domain, badger.utils.oneDayFromNow() * 7);
    });
  },


  /**
  * Asyncronously check if the domain has /.well-known/dnt-policy.txt and add it to the user whitelist if it does
  * TODO: Use sha256
  * @param {String} origin The host to check
  * @param {Function} callback callback(successStatus)
  */
  checkPrivacyBadgerPolicy: function(origin, callback){
    var successStatus = false;
    var url = "https://" + origin + "/.well-known/dnt-policy.txt";
    var dnt_hashes = this.storage.getBadgerStorageObject('dnt_hashes');

    utils.xhrRequest(url,function(err,response){
      if(err){
        callback(successStatus);
        return;
      }
      var hash = window.SHA1(response);
      if(dnt_hashes.hasItem(hash)){
        successStatus = true;
      }
      callback(successStatus);
    });
  },

  /**
   * Default privacy badger settings
   */
  defaultSettings: {
    socialWidgetReplacementEnabled: true,
    showCounter: true,
    disabledSites: [],
    isFirstRun: true,
    seenComic: false,
    migrationLevel: 0
  },

  /**
   * initialize default settings if nonexistent
   */
  initializeDefaultSettings: function(){
    var settings = this.storage.getBadgerStorageObject("settings_map");
    _.each(this.defaultSettings, function(value, key){
      if(!settings.hasItem(key)){
        log("setting", key, ":", value);
        settings.setItem(key, value);
      }
    });
  },

  runMigrations: function(){
    var settings = this.storage.getBadgerStorageObject("settings_map");
    var migrationLevel = settings.getItem('migrationLevel');
    var migrations = [
      Migrations.changePrivacySettings,
      Migrations.migrateAbpToStorage,
      Migrations.migrateBlockedSubdomainsToCookieblock,
    ];

    for (var i = migrationLevel; i < migrations.length; i++) {
      migrations[i].call(Migrations);
      settings.setItem('migrationLevel', i+1);
    }

  },

  /**
   * Helper function returns a list of all blocked origins for a tab
   * @param {Integer} tabId requested tab id as provided by chrome
   * @returns {*} A dictionary of third party origins and their actions
   */
  getAllOriginsForTab: function(tabId) {
    return Object.keys(this.tabData[tabId].trackers);
  },

  /**
   * count of blocked origins for a given tab
   * @param {Integer} tabId chrome tab id
   * @return {Integer} count of blocked origins
   */
  blockedOriginCount: function(tabId) {
    return this.getAllOriginsForTab(tabId).length;
  },

  /**
   * Counts the actively blocked trackers
   * TODO: move to popup.js and refactor
   *
   * @param tabId Tab ID to count for
   * @returns {Integer} The number of blocked trackers
   */
  activelyBlockedOriginCount: function(tabId){
    return this.getAllOriginsForTab(tabId)
      .reduce(function(memo,origin){
        var action = getAction(tabId, origin);
        if(action && action !== "noaction"){
          memo+=1;
        }
        return memo;
      }, 0);
  },

  /**
   * Counts total blocked trackers and blocked cookies trackers
   * TODO: ugly code, refactor
   *
   * @param tabId Tab ID to count for
   * @returns {Integer} The sum of blocked trackers and cookie blocked trackers
   */
  blockedTrackerCount: function(tabId){
    return this.getAllOriginsForTab(tabId)
      .reduce(function(memo,origin){
        var action = getAction(tabId,origin);
        if(action && (action == constants.USER_BLOCK || action ==
                    constants.BLOCK || action == constants.COOKIEBLOCK ||
                    action == constants.USER_COOKIE_BLOCK)){
          memo+=1;
        }
        return memo;
      }, 0);
  },

  /**
   * Counts trackers blocked by the user
   *
   * TODO: ugly code refactor
   * @param tabId Tab ID to count for
   * @returns {Integer} The number of blocked trackers
   */
  userConfiguredOriginCount: function(tabId){
    return this.getAllOriginsForTab(tabId)
      .reduce(function(memo,origin){
        var action = getAction(tabId,origin);
        if(action && action.lastIndexOf("user", 0) === 0){
          memo+=1;
        }
        return memo;
      }, 0);
  },
  /**
   * Update page action badge with current count
   * @param {Integer} tabId chrome tab id
   */
  updateBadge: function(tabId){
    if (!this.utils.showCounter()){
      chrome.browserAction.setBadgeText({tabId: tabId, text: ""});
      return;
    }
    var numBlocked = this.blockedTrackerCount(tabId);
    if(numBlocked === 0){
      chrome.browserAction.setBadgeBackgroundColor({tabId: tabId, color: "#00ff00"});
    } else {
      chrome.browserAction.setBadgeBackgroundColor({tabId: tabId, color: "#ff0000"});
    }
    chrome.browserAction.setBadgeText({tabId: tabId, text: numBlocked + ""});
  },

  /**
   * Checks conditions for updating page action badge and call updateBadge
   * @param {Object} details details object from onBeforeRequest event
   */
  updateCount: function(details) {
    if (details.tabId == -1){
      return {};
    }

    if(!this.utils.isPrivacyBadgerEnabled(this.webrequest.getHostForTab(details.tabId))){
      return;
    }

    var tabId = details.tabId;
    if (!this.tabData[tabId]) {
      return;
    }
    if(this.tabData[tabId].bgTab === true){
      // prerendered tab, Chrome will throw error for setBadge functions, don't call
      return;
    } else {
      var badger = this
      chrome.tabs.get(tabId, function(tab){
        if (chrome.runtime.lastError){
          badger.tabData[tabId].bgTab = true;
        } else {
          badger.tabData[tabId].bgTab = false;
          badger.updateBadge(tabId);
        }
      });
    }
  }
};

/**
 * functions that don't depend on Badger state.
 */

/**
* Log a message to the conosle if debugging is enabled
*/
function log(/*...*/) {
    if(DEBUG) {
      console.log.apply(console, arguments);
    }
};

function error(/*...*/) {
    if(DEBUG) {
      console.error.apply(console, arguments);
    }
};

/**
 * Chooese a privacy badger object to apply a callback to.
 */
function chooseWithTab(tabId, callback) {
    if (tabId == -1){
      return;
    }
    if (incognito.tabIsIncognito(tabId)) {
        callback(incognito_pb);
    } else {
        callback(pb);
    }
};

/**
 * Chooses the right badger to use badse on tabId.
 */
function getBadgerWithTab(tabId) {
    if (tabId == -1){
      return;
    }
    if (incognito.tabIsIncognito(tabId)) {
        return incognito_pb;
    } else {
        return pb;
    }
};


/**
 * Add the tracker and action to the tab.trackers object in tabData
 * which will be used by the privacy badger popup
 * @param tabId the tab we are on
 * @param fqdn the tracker to add
 * @param action the action we are taking
 **/
function logTrackerOnTab(tabId, fqdn, action) {
    chooseWithTab(tabId, function (badger) {
        badger.tabData[tabId].trackers[fqdn] = action;
    });
};

function updateCount(details) {
    chooseWithTab(details.tabId, function (badger) {
        badger.updateCount(details);
    });
};

/**
* reloads a tab
* @param {Integer} tabId the chrome tab id
*/
function reloadTab(tabId) {
    chrome.tabs.reload(tabId);
}

/**
 * Wrappers to be called by popup.js
 * Gets the action defined for the given tab/origin
 * @param {Integer} tabId The id to look up
 * @param {String} origin The URL of the 3rd party
 * @returns {String} The action defined for this tab/origin
 */
function getAction(tabId, origin) {
  var badger = getBadgerWithTab(tabId)
  return badger.storage.getBestAction(origin);
}

/**
 * Determine if a request would be blocked
 * @param {Integer} tabId Tab Id to check if the 3rd party should be blocked in
 * @param {String} origin URL of 3rd party to check if it should be blocked
 * @return {Boolean} true if block is requested
 */
function requestWouldBeBlocked(tabId, origin) {
  var action = getAction(tabId, origin);
  return action == constants.BLOCK || action == constants.USER_BLOCK;
}

/**
 * Checks whether a host is blocked
 * @param {String} url
 * @return {Boolean} true if the url is allowed false if not
 */
function isWhitelisted(url) {
  var host = window.extractHostFromURL(url);
  var action = pb.storage.getBestAction(host);
  if ([constants.ALLOW,
       constants.USER_ALLOW,
       constants.NO_TRACKING,
       constants.DNT].indexOf(action) >= 0){
      return true;
  } else {
      return false;
  }
}

/**
 * Enables or disables page action icon according to options.
 * @param {Object} tab The tab to set the badger icon for
 */
function refreshIconAndContextMenu(tab) {

  if(!tab){return;}

  var badger = getBadgerWithTab(tab.id);
  var iconFilename = badger.utils.isPrivacyBadgerEnabled(window.extractHostFromURL(tab.url)) ? {"19": "icons/badger-19.png", "38": "icons/badger-38.png"} : {"19": "icons/badger-19-disabled.png", "38": "icons/badger-38-disabled.png"};

  chrome.browserAction.setIcon({tabId: tab.id, path: iconFilename});
  chrome.browserAction.setTitle({tabId: tab.id, title: "Privacy Badger"});
}


/**
 * Check if a specific frame is whitelisted
 * TODO: used in popup-blocker.js inspect if necessary
 *
 * @param {Integer} tabId The id of the tab
 * @param {Integer} frameId The id of the frame
 * @param {String} type Content type to be checked
 * @returns {boolean} true if whitelisted
 */
function isFrameWhitelisted(tabId, frameId, type) {
  var parent = frameId;
  var parentData = webrequest.getFrameData(tabId, parent);
  while (parentData)
  {
    var frameData = parentData;

    parent = frameData.parent;
    parentData = webrequest.getFrameData(tabId, parent);

    var frameUrl = frameData.url;
    var parentUrl = (parentData ? parentData.url : frameUrl);
    if ("keyException" in frameData || isWhitelisted(frameUrl)){
      return true;
    }
  }
  return false;
}

/**************************** Listeners ****************************/

function startBackgroundListeners() {
  chrome.webRequest.onBeforeRequest.addListener(updateCount, {urls: ["http://*/*", "https://*/*"]}, []);

  // Update icon if a tab changes location
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(changeInfo.status == "loading") {
      if (tabId != tab.id) {
          console.log("what is going on!!??");
      }
      refreshIconAndContextMenu(tab);
    }
  });

  // Update icon if a tab is replaced or loaded from cache
  chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId){
    chrome.tabs.get(addedTabId, function(tab){
      refreshIconAndContextMenu(tab);
    });
  });

  // Listening for Avira Autopilot remote control UI
  // The Scout browser needs a "emergency off" switch in case Privacy Badger breaks a page.
  // The Privacy Badger UI will removed from the URL bar into the menu to achieve a cleaner UI in the future.
  if(chrome.runtime.onMessageExternal){
    chrome.runtime.onMessageExternal.addListener(
      function(request, sender, sendResponse) {
        // This is the ID of the Avira Autopilot extension, which is the central menu for the scout browser
        if (sender.id === "ljjneligifenjndbcopdndmddfcjpcng") {
          var badger = getBadgerWithTab(sender.tab.id);
          if (request.command == "getDisabledSites") {
            sendResponse({origins: badger.utils.listOriginsWherePrivacyBadgerIsDisabled()});
          }
          else if (request.command == "enable") {
            badger.utils.enablePrivacyBadgerForOrigin(request.origin);
          }
          else if (request.command == "disable") {
            badger.utils.disablePrivacyBadgerForOrigin(request.origin);
          }
        }
      }
    );
  }
  // Refresh domain exceptions popup list once every 24 hours and on startup
  setInterval(DomainExceptions.updateList,86400000);
  DomainExceptions.updateList();
};

/**
 * lets get this party started
 */
var pb = new Badger({}, false);
var incognito_pb = new Badger({}, true);

/**
 * Start all the listeners
 */
incognito.startListeners();
webrequest.startListeners();
HeuristicBlocking.startListeners();
startBackgroundListeners();
