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

/**
 * @fileOverview Manages synchronization of filter subscriptions.
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let {TimeLine} = require("timeline");
let {Utils} = require("utils");
let {FilterStorage} = require("filterStorage");
let {FilterNotifier} = require("filterNotifier");
let {Prefs} = require("prefs");
let {Filter, CommentFilter} = require("filterClasses");
let {Subscription, DownloadableSubscription} = require("subscriptionClasses");

let MILLISECONDS_IN_SECOND = 1000;
let SECONDS_IN_MINUTE = 60;
let SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
let SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;
let INITIAL_DELAY = 6 * SECONDS_IN_MINUTE;
let CHECK_INTERVAL = SECONDS_IN_HOUR;
let MIN_EXPIRATION_INTERVAL = 1 * SECONDS_IN_DAY;
let MAX_EXPIRATION_INTERVAL = 14 * SECONDS_IN_DAY;
let MAX_ABSENSE_INTERVAL = 1 * SECONDS_IN_DAY;

let timer = null;

/**
 * Map of subscriptions currently being downloaded, all currently downloaded
 * URLs are keys of that map.
 */
let executing = {__proto__: null};

/**
 * This object is responsible for downloading filter subscriptions whenever
 * necessary.
 * @class
 */
let Synchronizer = exports.Synchronizer =
{
  /**
   * Called on module startup.
   */
  init: function()
  {
    TimeLine.enter("Entered Synchronizer.init()");

    let callback = function()
    {
      timer.delay = CHECK_INTERVAL * MILLISECONDS_IN_SECOND;
      checkSubscriptions();
    };

    timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(callback, INITIAL_DELAY * MILLISECONDS_IN_SECOND, Ci.nsITimer.TYPE_REPEATING_SLACK);
    onShutdown.add(function()
    {
      timer.cancel();
    });

    TimeLine.leave("Synchronizer.init() done");
  },

  /**
   * Checks whether a subscription is currently being downloaded.
   * @param {String} url  URL of the subscription
   * @return {Boolean}
   */
  isExecuting: function(url)
  {
    return url in executing;
  },

  /**
   * Starts the download of a subscription.
   * @param {DownloadableSubscription} subscription  Subscription to be downloaded
   * @param {Boolean} manual  true for a manually started download (should not trigger fallback requests)
   * @param {Boolean}  forceDownload  if true, the subscription will even be redownloaded if it didn't change on the server
   */
  execute: function(subscription, manual, forceDownload)
  {
    // Delay execution, SeaMonkey 2.1 won't fire request's event handlers
    // otherwise if the window that called us is closed.
    Utils.runAsync(this.executeInternal, this, subscription, manual, forceDownload);
  },

  executeInternal: function(subscription, manual, forceDownload)
  {
    let url = subscription.url;
    if (url in executing)
      return;

    let newURL = subscription.nextURL;
    let hadTemporaryRedirect = false;
    subscription.nextURL = null;

    let loadFrom = newURL;
    let isBaseLocation = true;
    if (!loadFrom)
      loadFrom = url;
    if (loadFrom == url)
    {
      if (subscription.alternativeLocations)
      {
        // We have alternative download locations, choose one. "Regular"
        // subscription URL always goes in with weight 1.
        let options = [[1, url]];
        let totalWeight = 1;
        for each (let alternative in subscription.alternativeLocations.split(','))
        {
          if (!/^https?:\/\//.test(alternative))
            continue;

          let weight = 1;
          let match = /;q=([\d\.]+)$/.exec(alternative);
          if (match)
          {
            weight = parseFloat(match[1]);
            if (isNaN(weight) || !isFinite(weight) || weight < 0)
              weight = 1;
            if (weight > 10)
              weight = 10;

            alternative = alternative.substr(0, match.index);
          }
          options.push([weight, alternative]);
          totalWeight += weight;
        }

        let choice = Math.random() * totalWeight;
        for each (let [weight, alternative] in options)
        {
          choice -= weight;
          if (choice < 0)
          {
            loadFrom = alternative;
            break;
          }
        }

        isBaseLocation = (loadFrom == url);
      }
    }
    else
    {
      // Ignore modification date if we are downloading from a different location
      forceDownload = true;
    }

    let {addonVersion} = require("info");
    loadFrom = loadFrom.replace(/%VERSION%/, "ABP" + addonVersion);

    let request = null;
    let errorCallback = function(error)
    {
      let channelStatus = -1;
      try
      {
        channelStatus = request.channel.status;
      } catch (e) {}
      let responseStatus = "";
      try
      {
        responseStatus = request.channel.QueryInterface(Ci.nsIHttpChannel).responseStatus;
      } catch (e) {}
      setError(subscription, error, channelStatus, responseStatus, loadFrom, isBaseLocation, manual);
    };

    try
    {
      request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
      request.mozBackgroundRequest = true;
      request.open("GET", loadFrom);
    }
    catch (e)
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    try {
      request.overrideMimeType("text/plain");
      request.channel.loadFlags = request.channel.loadFlags |
                                  request.channel.INHIBIT_CACHING |
                                  request.channel.VALIDATE_ALWAYS;

      // Override redirect limit from preferences, user might have set it to 1
      if (request.channel instanceof Ci.nsIHttpChannel)
        request.channel.redirectionLimit = 5;

      var oldNotifications = request.channel.notificationCallbacks;
      var oldEventSink = null;
      request.channel.notificationCallbacks =
      {
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIInterfaceRequestor, Ci.nsIChannelEventSink]),

        getInterface: function(iid)
        {
          if (iid.equals(Ci.nsIChannelEventSink))
          {
            try {
              oldEventSink = oldNotifications.QueryInterface(iid);
            } catch(e) {}
            return this;
          }

          if (oldNotifications)
            return oldNotifications.QueryInterface(iid);
          else
            throw Cr.NS_ERROR_NO_INTERFACE;
        },

        asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback)
        {
          if (isBaseLocation && !hadTemporaryRedirect && oldChannel instanceof Ci.nsIHttpChannel)
          {
            try
            {
              subscription.alternativeLocations = oldChannel.getResponseHeader("X-Alternative-Locations");
            }
            catch (e)
            {
              subscription.alternativeLocations = null;
            }
          }

          if (flags & Ci.nsIChannelEventSink.REDIRECT_TEMPORARY)
            hadTemporaryRedirect = true;
          else if (!hadTemporaryRedirect)
            newURL = newChannel.URI.spec;

          if (oldEventSink)
            oldEventSink.asyncOnChannelRedirect(oldChannel, newChannel, flags, callback);
          else
            callback.onRedirectVerifyCallback(Cr.NS_OK);
        }
      }
    }
    catch (e)
    {
      Cu.reportError(e)
    }

    if (subscription.lastModified && !forceDownload)
      request.setRequestHeader("If-Modified-Since", subscription.lastModified);

    request.addEventListener("error", function(ev)
    {
      if (onShutdown.done)
        return;

      delete executing[url];
      try {
        request.channel.notificationCallbacks = null;
      } catch (e) {}

      errorCallback("synchronize_connection_error");
    }, false);

    request.addEventListener("load", function(ev)
    {
      if (onShutdown.done)
        return;

      delete executing[url];
      try {
        request.channel.notificationCallbacks = null;
      } catch (e) {}

      // Status will be 0 for non-HTTP requests
      if (request.status && request.status != 200 && request.status != 304)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      let newFilters = null;
      if (request.status != 304)
      {
        newFilters = readFilters(subscription, request.responseText, errorCallback);
        if (!newFilters)
          return;

        subscription.lastModified = request.getResponseHeader("Last-Modified");
      }

      if (isBaseLocation && !hadTemporaryRedirect)
        subscription.alternativeLocations = request.getResponseHeader("X-Alternative-Locations");
      subscription.lastSuccess = subscription.lastDownload = Math.round(Date.now() / MILLISECONDS_IN_SECOND);
      subscription.downloadStatus = "synchronize_ok";
      subscription.errors = 0;

      // Expiration header is relative to server time - use Date header if it exists, otherwise local time
      let now = Math.round((new Date(request.getResponseHeader("Date")).getTime() || Date.now()) / MILLISECONDS_IN_SECOND);
      let expires = Math.round(new Date(request.getResponseHeader("Expires")).getTime() / MILLISECONDS_IN_SECOND) || 0;
      let expirationInterval = (expires ? expires - now : 0);
      for each (let filter in newFilters || subscription.filters)
      {
        if (!(filter instanceof CommentFilter))
          continue;

        let match = /\bExpires\s*(?::|after)\s*(\d+)\s*(h)?/i.exec(filter.text);
        if (match)
        {
          let interval = parseInt(match[1], 10);
          if (match[2])
            interval *= SECONDS_IN_HOUR;
          else
            interval *= SECONDS_IN_DAY;

          if (interval > expirationInterval)
            expirationInterval = interval;
        }
      }

      // Expiration interval should be within allowed range
      expirationInterval = Math.min(Math.max(expirationInterval, MIN_EXPIRATION_INTERVAL), MAX_EXPIRATION_INTERVAL);

      // Hard expiration: download immediately after twice the expiration interval
      subscription.expires = (subscription.lastDownload + expirationInterval * 2);

      // Soft expiration: use random interval factor between 0.8 and 1.2
      subscription.softExpiration = (subscription.lastDownload + Math.round(expirationInterval * (Math.random() * 0.4 + 0.8)));

      // Process some special filters and remove them
      if (newFilters)
      {
        let fixedTitle = false;
        for (let i = 0; i < newFilters.length; i++)
        {
          let filter = newFilters[i];
          if (!(filter instanceof CommentFilter))
            continue;

          let match = /^!\s*(\w+)\s*:\s*(.*)/.exec(filter.text);
          if (match)
          {
            let keyword = match[1].toLowerCase();
            let value = match[2];
            let known = true;
            if (keyword == "redirect")
            {
              if (isBaseLocation && value != url)
                subscription.nextURL = value;
            }
            else if (keyword == "homepage")
            {
              let uri = Utils.makeURI(value);
              if (uri && (uri.scheme == "http" || uri.scheme == "https"))
                subscription.homepage = uri.spec;
            }
            else if (keyword == "title")
            {
              if (value)
              {
                subscription.title = value;
                fixedTitle = true;
              }
            }
            else
              known = false;

            if (known)
              newFilters.splice(i--, 1);
          }
        }
        subscription.fixedTitle = fixedTitle;
      }

      if (isBaseLocation && newURL && newURL != url)
      {
        let listed = (subscription.url in FilterStorage.knownSubscriptions);
        if (listed)
          FilterStorage.removeSubscription(subscription);

        url = newURL;

        let newSubscription = Subscription.fromURL(url);
        for (let key in newSubscription)
          delete newSubscription[key];
        for (let key in subscription)
          newSubscription[key] = subscription[key];

        delete Subscription.knownSubscriptions[subscription.url];
        newSubscription.oldSubscription = subscription;
        subscription = newSubscription;
        subscription.url = url;

        if (!(subscription.url in FilterStorage.knownSubscriptions) && listed)
          FilterStorage.addSubscription(subscription);
      }

      if (newFilters)
        FilterStorage.updateSubscriptionFilters(subscription, newFilters);
      delete subscription.oldSubscription;
    }, false);

    executing[url] = true;
    FilterNotifier.triggerListeners("subscription.downloadStatus", subscription);

    try
    {
      request.send(null);
    }
    catch (e)
    {
      delete executing[url];
      errorCallback("synchronize_connection_error");
      return;
    }
  }
};
Synchronizer.init();

/**
 * Checks whether any subscriptions need to be downloaded and starts the download
 * if necessary.
 */
function checkSubscriptions()
{
  if (!Prefs.subscriptions_autoupdate)
    return;

  let time = Math.round(Date.now() / MILLISECONDS_IN_SECOND);
  for each (let subscription in FilterStorage.subscriptions)
  {
    if (!(subscription instanceof DownloadableSubscription))
      continue;

    if (subscription.lastCheck && time - subscription.lastCheck > MAX_ABSENSE_INTERVAL)
    {
      // No checks for a long time interval - user must have been offline, e.g.
      // during a weekend. Increase soft expiration to prevent load peaks on the
      // server.
      subscription.softExpiration += time - subscription.lastCheck;
    }
    subscription.lastCheck = time;

    // Sanity check: do expiration times make sense? Make sure people changing
    // system clock don't get stuck with outdated subscriptions.
    if (subscription.expires - time > MAX_EXPIRATION_INTERVAL)
      subscription.expires = time + MAX_EXPIRATION_INTERVAL;
    if (subscription.softExpiration - time > MAX_EXPIRATION_INTERVAL)
      subscription.softExpiration = time + MAX_EXPIRATION_INTERVAL;

    if (subscription.softExpiration > time && subscription.expires > time)
      continue;

    // Do not retry downloads more often than MIN_EXPIRATION_INTERVAL
    if (time - subscription.lastDownload >= MIN_EXPIRATION_INTERVAL)
      Synchronizer.execute(subscription, false);
  }
}

/**
 * Extracts a list of filters from text returned by a server.
 * @param {DownloadableSubscription} subscription  subscription the info should be placed into
 * @param {String} text server response
 * @param {Function} errorCallback function to be called on error
 * @return {Array of Filter}
 */
function readFilters(subscription, text, errorCallback)
{
  let lines = text.split(/[\r\n]+/);
  let match = /\[Adblock(?:\s*Plus\s*([\d\.]+)?)?\]/i.exec(lines[0]);
  if (!match)
  {
    errorCallback("synchronize_invalid_data");
    return null;
  }
  let minVersion = match[1];

  for (let i = 0; i < lines.length; i++)
  {
    let match = /!\s*checksum[\s\-:]+([\w\+\/]+)/i.exec(lines[i]);
    if (match)
    {
      lines.splice(i, 1);
      let checksum = Utils.generateChecksum(lines);

      if (checksum && checksum != match[1])
      {
        errorCallback("synchronize_checksum_mismatch");
        return null;
      }

      break;
    }
  }

  delete subscription.requiredVersion;
  delete subscription.upgradeRequired;
  if (minVersion)
  {
    let {addonVersion} = require("info");
    subscription.requiredVersion = minVersion;
    if (Services.vc.compare(minVersion, addonVersion) > 0)
      subscription.upgradeRequired = true;
  }

  lines.shift();
  let result = [];
  for each (let line in lines)
  {
    line = Filter.normalize(line);
    if (line)
      result.push(Filter.fromText(line));
  }

  return result;
}

/**
 * Handles an error during a subscription download.
 * @param {DownloadableSubscription} subscription  subscription that failed to download
 * @param {Integer} channelStatus result code of the download channel
 * @param {String} responseStatus result code as received from server
 * @param {String} downloadURL the URL used for download
 * @param {String} error error ID in global.properties
 * @param {Boolean} isBaseLocation false if the subscription was downloaded from a location specified in X-Alternative-Locations header
 * @param {Boolean} manual  true for a manually started download (should not trigger fallback requests)
 */
function setError(subscription, error, channelStatus, responseStatus, downloadURL, isBaseLocation, manual)
{
  // If download from an alternative location failed, reset the list of
  // alternative locations - have to get an updated list from base location.
  if (!isBaseLocation)
    subscription.alternativeLocations = null;

  try {
    Cu.reportError("Adblock Plus: Downloading filter subscription " + subscription.title + " failed (" + Utils.getString(error) + ")\n" +
                   "Download address: " + downloadURL + "\n" +
                   "Channel status: " + channelStatus + "\n" +
                   "Server response: " + responseStatus);
  } catch(e) {}

  subscription.lastDownload = Math.round(Date.now() / MILLISECONDS_IN_SECOND);
  subscription.downloadStatus = error;

  // Request fallback URL if necessary - for automatic updates only
  if (!manual)
  {
    if (error == "synchronize_checksum_mismatch")
    {
      // No fallback for successful download with checksum mismatch, reset error counter
      subscription.errors = 0;
    }
    else
      subscription.errors++;

    if (subscription.errors >= Prefs.subscriptions_fallbackerrors && /^https?:\/\//i.test(subscription.url))
    {
      subscription.errors = 0;

      let fallbackURL = Prefs.subscriptions_fallbackurl;
      let {addonVersion} = require("info");
      fallbackURL = fallbackURL.replace(/%VERSION%/g, encodeURIComponent(addonVersion));
      fallbackURL = fallbackURL.replace(/%SUBSCRIPTION%/g, encodeURIComponent(subscription.url));
      fallbackURL = fallbackURL.replace(/%URL%/g, encodeURIComponent(downloadURL));
      fallbackURL = fallbackURL.replace(/%ERROR%/g, encodeURIComponent(error));
      fallbackURL = fallbackURL.replace(/%CHANNELSTATUS%/g, encodeURIComponent(channelStatus));
      fallbackURL = fallbackURL.replace(/%RESPONSESTATUS%/g, encodeURIComponent(responseStatus));

      let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
      request.mozBackgroundRequest = true;
      request.open("GET", fallbackURL);
      request.overrideMimeType("text/plain");
      request.channel.loadFlags = request.channel.loadFlags |
                                  request.channel.INHIBIT_CACHING |
                                  request.channel.VALIDATE_ALWAYS;
      request.addEventListener("load", function(ev)
      {
        if (onShutdown.done)
          return;

        if (!(subscription.url in FilterStorage.knownSubscriptions))
          return;

        let match = /^(\d+)(?:\s+(\S+))?$/.exec(request.responseText);
        if (match && match[1] == "301" && match[2]) // Moved permanently
          subscription.nextURL = match[2];
        else if (match && match[1] == "410")        // Gone
        {
          let data = "[Adblock]\n" + subscription.filters.map(function(f) f.text).join("\n");
          let url = "data:text/plain," + encodeURIComponent(data);
          let newSubscription = Subscription.fromURL(url);
          newSubscription.title = subscription.title;
          newSubscription.disabled = subscription.disabled;
          FilterStorage.removeSubscription(subscription);
          FilterStorage.addSubscription(newSubscription);
          Synchronizer.execute(newSubscription);
        }
      }, false);
      request.send(null);
    }
  }
}
