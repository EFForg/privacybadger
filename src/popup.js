/*
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

var backgroundPage = chrome.extension.getBackgroundPage();
var require = backgroundPage.require;
var imports = ["require", "isWhitelisted", "extractHostFromURL", "refreshIconAndContextMenu", "getAction", "blockedOriginCount", "activelyBlockedOriginCount", "userConfiguredOriginCount", "getAllOriginsForTab", "console", "whitelistUrl", "removeFilter", "setupCookieBlocking", "teardownCookieBlocking", "reloadTab", "saveAction", "getHostForTab", "getBaseDomain", "getPresumedAction"];
var i18n = chrome.i18n;
for (var i = 0; i < imports.length; i++){
  window[imports[i]] = backgroundPage[imports[i]];
}


with(require("filterClasses"))
{
  this.Filter = Filter;
  this.RegExpFilter = RegExpFilter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
  this.SpecialSubscription = SpecialSubscription;
}
var FilterStorage = require("filterStorage").FilterStorage;
var matcherStore = require("matcher").matcherStore;
var Utils = require("utils").Utils;

var tab = null;

function closeOverlay() {
  $('#overlay').toggleClass('active', false);
  $("#report_success").toggleClass("hidden", true);
  $("#report_fail").toggleClass("hidden", true);
  $("#error_input").val("");
}

/**
 * Init function. Showing/hiding popup.html elements and setting up event handler
 */
function init() {
  console.log("Initializing popup.js");
  
  $("#firstRun").hide();
  var seenComic = JSON.parse(localStorage.getItem("seenComic")) || false;
  if (!seenComic) {
    $("#firstRun").show();
  }

  // Attach event listeners
  $("#firstRun").click(function() {
    chrome.tabs.create({
      url: chrome.extension.getURL("/skin/firstRun.html#slideshow")
    });
  });

  $("#activate_site_btn").click(active_site);
  $("#deactivate_site_btn").click(deactive_site);
  $("#error_input").attr("placeholder", i18n.getMessage("error_input"));
  //$("#enabled").click(toggleEnabled);
  var overlay = $('#overlay');
  $("#error").click(function(){
      overlay.toggleClass('active');
  });
  $("#report_cancel").click(function(){
      closeOverlay();
  });
  $("#report_button").click(function(){
      $(this).prop("disabled", true);
      $("#report_cancel").prop("disabled", true);
      send_error($("#error_input").val());
  });
  $("#report_close").click(function(){
      closeOverlay();
  });
  $(document).ready(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);
    $('#blockedResourcesContainer').on('mouseenter', '.tooltip', displayTooltip);
    $('#blockedResourcesContainer').on('mouseleave', '.tooltip', hideTooltip);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);
  });

  //toggle activation buttons if privacy badger is not enabled for current url
  chrome.windows.getCurrent(function(w)
  {
    chrome.tabs.getSelected(w.id, function(t)
    {
      tab = t;
      if(!Utils.isPrivacyBadgerEnabled(extractHostFromURL(tab.url))) {
        $("#blockedResourcesContainer").hide();
        $("#activate_site_btn").show();
        $("#deactivate_site_btn").hide();
      }
    });
  });
}
$(init);



/**
 * Send errors to PB error reporting server
 *
 * @param {String} message The message to send
 */
function send_error(message) {
  var browser = window.navigator.userAgent;
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var origins = getAllOriginsForTab(tabId);
  if(!origins){ return; }
  var version = localStorage.currentVersion;
  //TODO "there's got to be a better way!"
  var fqdn = tab.url.split("/",3)[2];
  var out = {"browser":browser, "url":tab.url,"fqdn":fqdn, "message":message, "version": version};
  for (var i = 0; i < origins.length; i++){
     var origin = origins[i];
     var action = getAction(tabId, origin);
     if (!action){ action = "notracking"; }
     if (out[action]){
       out[action] += ","+origin;
     }
     else{
       out[action] = origin;
     }
  }
  var out_data = JSON.stringify(out);
  console.log(out_data);
  var sendReport = $.ajax({
    type: "POST",
    url: "https://privacybadger.org/reporting",
    data: out_data,
    contentType: "application/json"
  });
  sendReport.done(function() {
    $("#error_input").val("");
    $("#report_success").toggleClass("hidden", false);
    setTimeout(function(){
      $("#report_button").prop("disabled", false);
      $("#report_cancel").prop("disabled", false);
      $("#report_success").toggleClass("hidden", true);
      closeOverlay();
   }, 3000);
  });
  sendReport.fail(function() {
    $("#report_fail").toggleClass("hidden");
    setTimeout(function(){
      $("#report_button").prop("disabled", false);
      $("#report_cancel").prop("disabled", false);
      $("#report_fail").toggleClass("hidden", true);
   }, 3000);
  });
}

/**
 * activate PB for site event handler
 */
function active_site(){
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").show();
  Utils.enablePrivacyBadgerForOrigin(extractHostFromURL(tab.url));
  refreshIconAndContextMenu(tab);
  reloadTab(tab.id);
}

/**
 * de-activate PB for site event handler
 */
function deactive_site(){
  $("#activate_site_btn").toggle();
  $("#deactivate_site_btn").toggle();
  $("#blockedResourcesContainer").hide();
  Utils.disablePrivacyBadgerForOrigin(extractHostFromURL(tab.url));
  refreshIconAndContextMenu(tab);
  reloadTab(tab.id);
}

/**
 * Handler to undo user selection for a tracker
 *
 * @param e The object the event triggered on
 * @returns {boolean} false
 */
function revertDomainControl(e){
  $elm = $(e.target).parent();
  console.log('revert to privacy badger control for', $elm);
  var origin = $elm.data('origin');
  var original_action = $elm.data('original-action');
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var stores = {'block': 'userRed', 
                'cookieblock': 'userYellow', 
                'noaction': 'userGreen'};
  var filter = "||" + origin + "^$third-party";
  var siteFilter = "@@||" + origin + "^$third-party,domain=" + getHostForTab(tabId);
  var store = stores[original_action];
  removeFilter(store,filter);
  removeFilter(store,siteFilter);
  var defaultAction = getPresumedAction(origin);
  var selectorId = "#"+ defaultAction +"-" + origin.replace(/\./g,'-');
  var selector =   $(selectorId);
  console.log('selector', selector);
  selector.click();
  $elm.removeClass('userset');
  reloadTab(tabId);
  return false;
}

/**
 * Toggles the icon, not used
 */
function toggleEnabled() {
  console.log("Refreshing icon and context menu");
  refreshIconAndContextMenu(tab);
}

// ugly helpers: not to be used!
/**
 * Generate some html (the part specific for each origin)
 *
 * @param {String} origin data origin value
 * @param {String} printable HTML top prepend
 * @param {String} action user/block/cookieblock
 * @returns {string}
 * @private
 */
function _addOriginHTML(origin, printable, action, flag, multiTLD) {
  //console.log("Popup: adding origin HTML for " + origin);
  var classes = ["clicker","tooltip"];
  var feedTheBadgerTitle = '';
  if (action.indexOf("user") === 0) {
    feedTheBadgerTitle = i18n.getMessage("feed_the_badger_title");
    classes.push("userset");
    action = action.substr(4);
  }
  if (action == "block" || action == "cookieblock"){
    classes.push(action);
  }
  var classText = 'class="' + classes.join(" ") + '"';
  var flagText = "";
  if (flag) {
    flagText = "<div id='dnt-compliant'>" + 
      "<a target=_blank href='https://www.eff.org/privacybadger#faq--I-am-an-online-advertising-/-tracking-company.--How-do-I-stop-Privacy-Badger-from-blocking-me?'>" +
      "<img src='/icons/dnt-16.png' title='This domain promises not to track you.'></a></div>";
  }
  var multiText = "";
  if(multiTLD){
    multiText = " ("+multiTLD +" subdomains)";
  }

  return printable + '<div ' + classText + '" data-origin="' + origin + '" tooltip="' + _badgerStatusTitle(action) + '" data-original-action="' + action + '"><div class="origin" >' +
     flagText + _trim(origin + multiText,30) + '</div>' + _addToggleHtml(origin, action) + '<div class="honeybadgerPowered tooltip" tooltip="'+ feedTheBadgerTitle + '"></div><img class="tooltipArrow" src="/icons/badger-tb-arrow.png"><div class="clear"></div><div class="tooltipContainer"></div></div>';
  
}

/**
 * Trim a str down to a max. length
 *
 * @param {String} str The string to trim
 * @param {Integer} max
 * @returns {String} The shortened string
 * @private
 */
function _trim(str,max){
  if(str.length >= max){
    return str.slice(0,max-3)+'...';
  } else {
    return str;
  }
}

/**
 * Get the message for the action different (I18N)
 *
 * @param {String} action The action description to get
 * @returns {string} The description, I18Ned
 * @private
 */
function _badgerStatusTitle(action){
  var prefix = "";
  var status_block = i18n.getMessage("badger_status_block");
  var status_cookieblock = i18n.getMessage("badger_status_cookieblock");
  var status_noaction = i18n.getMessage("badger_status_noaction");

  var statusMap = { 
    block:        status_block,
    cookieblock:  status_cookieblock,
    noaction:     status_noaction
  };

  return prefix + statusMap[action];
}

/**
 * Generate the 3 action options toggle switch
 *
 * @param {String} origin Origin url
 * @param {String } action The current action
 * @returns {string} The HTML displaying that
 * @private
 */
function _addToggleHtml(origin, action){
  var idOrigin = origin.replace(/\./g,'-');
  var output = "";
  output += '<div class="switch-container ' + action + '">';
  output += '<div class="switch-toggle switch-3 switch-candy">';
  output += '<input id="block-' + idOrigin + '" name="' + origin + '" value="0" type="radio" '+ _checked('block',action)+ '><label tooltip="click here to block this tracker entirely" class="actionToggle" for="block-' + idOrigin + '" data-origin="' + origin + '" data-action="block"></label>';
  output += '<input id="cookieblock-' + idOrigin + '" name="' + origin + '" value="1" type="radio" '+ _checked('cookieblock',action)+ '><label tooltip="click here to block this tracker from setting cookies" class="actionToggle" for="cookieblock-' + idOrigin + '" data-origin="' + origin + '" data-action="cookieblock"></label>';
  output += '<input id="noaction-' + idOrigin + '" name="' + origin + '" value="2" type="radio" '+ _checked('noaction',action)+ '><label tooltip="click here to allow this tracker" class="actionToggle" for="noaction-' + idOrigin + '" data-origin="' + origin + '" data-action="noaction"></label>';
  output += '<a><img src="/icons/badger-slider-handle.png"></a></div></div>';
  return output;
}

/**
 * Helper function to test if a action matches the name
 *
 * @param {String} name name to test
 * @param {String} action actual action string
 * @returns {*} true if equal
 * @private
 */
function _checked(name, action){
  if(name == action){
    return 'checked';
  } else {
    return '';
  }
}

/**
 * Toggle the GUI blocked status of GUI element(s)
 *
 * @param {String} elt Identify the object(s) to manipulate
 * @param {String} status New status to set, optional
 */
function toggleBlockedStatus(elt,status) {
  console.log('toggle blocked status', elt, status);
  if(status){
    $(elt).removeClass("block cookieblock noaction").addClass(status);
    $(elt).addClass("userset");
    return;
  }

  var originalAction = elt.getAttribute('data-original-action');
  if ($(elt).hasClass("block"))
    $(elt).toggleClass("block");
  else if ($(elt).hasClass("cookieblock")) {
    $(elt).toggleClass("block");
    $(elt).toggleClass("cookieblock");
  }
  else 
    $(elt).toggleClass("cookieblock");
  if ($(elt).hasClass(originalAction) || (originalAction == 'noaction' && !($(elt).hasClass("block") || 
                                                                            $(elt).hasClass("cookieblock"))))
    $(elt).removeClass("userset");
  else
    $(elt).addClass("userset");
}

/**
 * Compare 2 domains. Reversing them to start comparing the least significant parts (TLD) first
 *
 * @param a First domain
 * @param b Second domain
 * @returns {number} standard compare returns
 */
function compareReversedDomains(a, b){
  fqdn1 = makeSortable(a);
  fqdn2 = makeSortable(b);
  if(fqdn1 < fqdn2){
    return -1;
  }
  if(fqdn1 > fqdn2){
    return 1;
  }
  return 0;
}

/**
 * Reverse order of domain items to have the least exact (TLD) first)
 *
 * @param {String} domain The domain to shuffle
 * @returns {String} The 'reversed' domain
 */
function makeSortable(domain){
  var tmp = domain.split('.').reverse();
  tmp.shift();
  return tmp.join('');
}

/**
 * this is a terrible function that repeats
 * a lot of the work that getAction does
 * because getAction stores things in mysery
 * land and there's no real way to get what's
 * in the ABP filters without repeatedly
 * querying them
 */
function getTopLevel(action, origin, tabId){
  if (action == "usercookieblock"){
    var top = backgroundPage.getDomainFromFilter(matcherStore.combinedMatcherStore.userYellow.matchesAny(origin, "SUBDOCUMENT", getHostForTab(tabId), true).text);
    return  top;
  }
  if (action == "userblock"){
    var top = backgroundPage.getDomainFromFilter(matcherStore.combinedMatcherStore.userRed.matchesAny(origin, "SUBDOCUMENT", getHostForTab(tabId), true).text);
    return top;
  }
  if (action == "usernoaction"){
    var top = backgroundPage.getDomainFromFilter(matcherStore.combinedMatcherStore.userGreen.matchesAny(origin, "SUBDOCUMENT", getHostForTab(tabId), true).text);
    return top;
  }
}

function isDomainWhitelisted(action, origin){
  var flag = false;
  if (action == "usernoaction"){
    if (localStorage.whitelisted && JSON.parse(localStorage.whitelisted).hasOwnProperty(origin)){
      flag = true;
    }
  }
  return flag;
}

/**
 * Refresh the content of the popup window
 *
 * @param {Integer} tabId The id of the tab
 */
function refreshPopup(tabId) {
  console.log("Refreshing popup for tab id " + tabId);
  //TODO this is calling get action and then being used to call get Action
  var origins = getAllOriginsForTab(tabId);
  if (!origins || origins.length === 0) {
    hideNoInitialBlockingLink();
    $("#blockedResources").html(i18n.getMessage("popup_blocked"));
  $('#number_trackers').text('0');
    return;
  }
  var printable = '<div id="associatedTab" data-tab-id="' + tabId + '"></div>';
  printable = printable + 
    '<div class="keyContainer">'+
    '<div class="key">'+
    '<img class="tooltip" src="/icons/UI-icons-red.png" tooltip="Move the slider left to block a domain.">'+
    '<img class="tooltip" src="/icons/UI-icons-yellow.png" tooltip="Center the slider to block cookies.">'+
    '<img class="tooltip" src="/icons/UI-icons-green.png" tooltip="Move the slider right to allow a domain.">'+
    '<div class="tooltipContainer"></div>' +
    '</div></div>'+
    '<div class="spacer"></div><div class="clickerContainer">';
  var nonTracking = [];
  origins.sort(compareReversedDomains);
  originCount = 0;
  var compressedOrigins = {};
  for (var i=0; i < origins.length; i++) {
    var origin = origins[i];
    // todo: gross hack, use templating framework
    var action = getAction(tabId, origin);
    if(!action){ 
        nonTracking.push(origin);
        continue; 
    }
    else {
      if (action.includes("user")){
        var prevOrigin = origin;
        var baseDomain = getBaseDomain(prevOrigin);
        if (getTopLevel(action, origin, tabId) == baseDomain && baseDomain != origin){
          origin = baseDomain;
          if (compressedOrigins.hasOwnProperty(origin)){
            compressedOrigins[origin]['subs'].push(prevOrigin.replace(origin, ''));
            continue;
          }
          compressedOrigins[origin] = {'action': action, 'subs':[prevOrigin.replace(origin, '')]};
          continue;
        }
      }
    }
    originCount++;
    var flag = isDomainWhitelisted(action, origin);
    printable = _addOriginHTML(origin, printable, action, flag);
  }
  for (key in compressedOrigins){
    var flag2 = isDomainWhitelisted(action, origin); 
    printable = _addOriginHTML( key, printable, compressedOrigins[key]['action'], flag2, compressedOrigins[key]['subs'].length);
  }
  var nonTrackerText = i18n.getMessage("non_tracker");
  var nonTrackerTooltip = i18n.getMessage("non_tracker_tip");
  if(nonTracking.length > 0){
    printable = printable +
        '<div class="clicker" id="nonTrackers" title="'+nonTrackerTooltip+'">'+nonTrackerText+'</div>';
    for (var i = 0; i < nonTracking.length; i++){
      var ntOrigin = nonTracking[i];
      printable = _addOriginHTML(ntOrigin, printable, "noaction", false);
    }
  }
  $('#number_trackers').text(originCount);
  printable += "</div>";
  $("#blockedResources").empty();
  $("#blockedResources").html(printable);
  $('.switch-toggle').each(function(){
    var radios = $(this).children('input');
    var value = $(this).children('input:checked').val();
    var userHandle = $(this).children('a');
    var slider = $("<div></div>").slider({
      min: 0,
      max: 2,
      value: value,
      create: function(event, ui){
        $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
      },
      slide: function(event, ui) {
        radios.filter("[value=" + ui.value + "]").click();
      },
      stop: function(event, ui){
        $(ui.handle).css('margin-left', -16 * ui.value + "px");
      },
    }).appendTo(this);
    radios.change(function(){
      slider.slider("value",radios.filter(':checked').val());
    });
  });
  adjustNoInitialBlockingLink();
  console.log("Done refreshing popup");
}


/**
 * Event handler for on change (blocked resources container)
 *
 * @param event
 */
function updateOrigin(event){
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  console.log('updating origin for', $elm);
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var action = $elm.data('action');
  $switchContainer.removeClass('block cookieblock noaction').addClass(action);
  toggleBlockedStatus($clicker, action);
  $clicker.attr('tooltip', _badgerStatusTitle(action));
  $clicker.children('.tooltipContainer').html(_badgerStatusTitle(action));
  hideNoInitialBlockingLink();
}

/**
 * Hide #noBlockingLink
 */
function hideNoInitialBlockingLink() {
  $("#noBlockingLink").hide();
}

/**
 * Hide or show additional info depending on if there is any additional info
 */
function adjustNoInitialBlockingLink() {
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  var origins = blockedOriginCount(tabId);
  var totalBlocked = activelyBlockedOriginCount(tabId), userBlocked = userConfiguredOriginCount(tabId);
  if (origins > 0 && totalBlocked === 0 && userBlocked === 0) {
    $("#noBlockingLink").show();
  } else {
    $("#noBlockingLink").hide();
  }
}

var tooltipDelay = 300;

/**
 * Show tooltip for elements
 *
 * @param event
 */
function displayTooltip(event){
  var $elm = $(event.currentTarget);
  var displayTipTimer = setTimeout(function(){
    if($elm.attr('tooltip').length === 0){ return; }
    var $container = $elm.closest('.clicker').children('.tooltipContainer');
    if($container.length === 0){
      $container = $elm.siblings('.tooltipContainer');
    }
    $container.text($elm.attr('tooltip'));
    $container.show();
    $container.siblings('.tooltipArrow').show();
  },tooltipDelay);
  $elm.on('mouseleave', function(){clearTimeout(displayTipTimer);}); 
}

/**
 * Hide tooltip for element
 *
 * @param event
 */
function hideTooltip(event){
  var $elm = $(event.currentTarget);
  var hideTipTimer = setTimeout(function(){
    var $container = $elm.closest('.clicker').children('.tooltipContainer');
    if($container.length === 0){
      $container = $elm.siblings('.tooltipContainer');
    }
    if($container.is(':hidden')){return;}
    $container.text('');
    $container.hide();
    $container.siblings('.tooltipArrow').hide();
  },tooltipDelay);
  $elm.on('mouseenter',function(){clearTimeout(hideTipTimer);});
}

/**
 * Check if origin is in setting dict. If yes, popup needs refresh
 *
 * @param settingsDict The settings dict to check
 * @returns {boolean} false or the tab id
 */
function syncSettingsDict(settingsDict) {
  // track whether reload is needed: only if things are being unblocked
  var reloadNeeded = false;
  var tabId = parseInt($('#associatedTab').attr('data-tab-id'), 10);
  // we get the blocked data again in case anything changed, but the user's change when
  // closing a popup is authoritative and we should sync the real state to that
  for (var origin in settingsDict) {
    var userAction = settingsDict[origin];
    if (saveAction(userAction, origin))
      reloadNeeded = tabId; // js question: slower than "if (!reloadNeeded) reloadNeeded = true"?
                           // would be fun to check with jsperf.com
  }
  console.log("Finished syncing. Now refreshing popup.");
  // the popup needs to be refreshed to display current results
  refreshPopup(tabId);
  return reloadNeeded;
}

/**
 * Get the action class from the element
 *
 * @param elt Element
 * @returns {String} block/cookieblock/noaction
 */
function getCurrentClass(elt) {
  if ($(elt).hasClass("block"))
    return "block";
  else if ($(elt).hasClass("cookieblock"))
    return "cookieblock";
  else
    return "noaction";
}

/**
 * Generates dict Origin->action based on GUI elements
 *
 * @returns {{}} The generated dict
 */
function buildSettingsDict() {
  var settingsDict = {};
  $('.clicker').each(function() {
    var origin = $(this).attr("data-origin");
    if ($(this).hasClass("userset") && getCurrentClass(this) != $(this).attr("data-original-action")) {
      // todo: DRY; same as code above, break out into helper
      if ($(this).hasClass("block"))
        settingsDict[origin] = "block";
      else if ($(this).hasClass("cookieblock"))
        settingsDict[origin] = "cookieblock";
      else
        settingsDict[origin] = "noaction";
    }
  });
  return settingsDict;
}

/**
 * syncs the user-selected cookie blocking options, etc.
 * Reloads the tab if needed
 */
function syncUISelections() {
  var settingsDict = buildSettingsDict();
  console.log("Sync of userset options: " + JSON.stringify(settingsDict));
  var tabId = syncSettingsDict(settingsDict);
  if (tabId){
    reloadTab(tabId);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, function(tab) {
    console.log("from addEventListener");
    refreshPopup(tab.id);
  });
});

window.addEventListener('unload', function() {
  console.log("Starting to unload popup");
  syncUISelections();
  console.log("unloaded popup");
});

