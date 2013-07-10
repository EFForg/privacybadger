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
 * @fileOverview Public Adblock Plus API.
 */

var EXPORTED_SYMBOLS = ["AdblockPlus"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function require(module)
{
  let result = {};
  result.wrappedJSObject = result;
  Services.obs.notifyObservers(result, "adblockplus-require", module);
  return result.exports;
}

let {FilterStorage} = require("filterStorage");
let {Filter} = require("filterClasses");
let {Subscription, SpecialSubscription, RegularSubscription, DownloadableSubscription, ExternalSubscription} = require("subscriptionClasses");

const externalPrefix = "~external~";

/**
 * Class implementing public Adblock Plus API
 * @class
 */
var AdblockPlus =
{
  /**
   * Returns current subscription count
   * @type Integer
   */
  get subscriptionCount()
  {
    return FilterStorage.subscriptions.length;
  },

  /**
   * Gets a subscription by its URL
   */
  getSubscription: function(/**String*/ id) /**IAdblockPlusSubscription*/
  {
    if (id in FilterStorage.knownSubscriptions)
      return createSubscriptionWrapper(FilterStorage.knownSubscriptions[id]);

    return null;
  },

  /**
   * Gets a subscription by its position in the list
   */
  getSubscriptionAt: function(/**Integer*/ index) /**IAdblockPlusSubscription*/
  {
    if (index < 0 || index >= FilterStorage.subscriptions.length)
      return null;

    return createSubscriptionWrapper(FilterStorage.subscriptions[index]);
  },

  /**
   * Updates an external subscription and creates it if necessary
   */
  updateExternalSubscription: function(/**String*/ id, /**String*/ title, /**Array of Filter*/ filters) /**String*/
  {
    if (id.substr(0, externalPrefix.length) != externalPrefix)
      id = externalPrefix + id;
    let subscription = Subscription.knownSubscriptions[id];
    if (typeof subscription == "undefined")
      subscription = new ExternalSubscription(id, title);

    subscription.lastDownload = parseInt(new Date().getTime() / 1000);

    let newFilters = [];
    for each (let filter in filters)
    {
      filter = Filter.fromText(Filter.normalize(filter));
      if (filter)
        newFilters.push(filter);
    }

    if (id in FilterStorage.knownSubscriptions)
      FilterStorage.updateSubscriptionFilters(subscription, newFilters);
    else
    {
      subscription.filters = newFilters;
      FilterStorage.addSubscription(subscription);
    }

    return id;
  },

  /**
   * Removes an external subscription by its identifier
   */
  removeExternalSubscription: function(/**String*/ id) /**Boolean*/
  {
    if (id.substr(0, externalPrefix.length) != externalPrefix)
      id = externalPrefix + id;
    if (!(id in FilterStorage.knownSubscriptions))
      return false;

    FilterStorage.removeSubscription(FilterStorage.knownSubscriptions[id]);
    return true;
  },

  /**
   * Adds user-defined filters to the list
   */
  addPatterns: function(/**Array of String*/ filters)
  {
    for each (let filter in filters)
    {
      filter = Filter.fromText(Filter.normalize(filter));
      if (filter)
      {
        filter.disabled = false;
        FilterStorage.addFilter(filter);
      }
    }
  },

  /**
   * Removes user-defined filters from the list
   */
  removePatterns: function(/**Array of String*/ filters)
  {
    for each (let filter in filters)
    {
      filter = Filter.fromText(Filter.normalize(filter));
      if (filter)
        FilterStorage.removeFilter(filter);
    }
  },

  /**
   * Returns installed Adblock Plus version
   */
  getInstalledVersion: function() /**String*/
  {
    return require("info").addonVersion;
  },

  /**
   * Returns source code revision this Adblock Plus build was created from (if available)
   */
  getInstalledBuild: function() /**String*/
  {
    return "";
  },
};

/**
 * Wraps a subscription into IAdblockPlusSubscription structure.
 */
function createSubscriptionWrapper(/**Subscription*/ subscription) /**IAdblockPlusSubscription*/
{
  if (!subscription)
    return null;

  return {
    url: subscription.url,
    special: subscription instanceof SpecialSubscription,
    title: subscription.title,
    autoDownload: true,
    disabled: subscription.disabled,
    external: subscription instanceof ExternalSubscription,
    lastDownload: subscription instanceof RegularSubscription ? subscription.lastDownload : 0,
    downloadStatus: subscription instanceof DownloadableSubscription ? subscription.downloadStatus : "synchronize_ok",
    lastModified: subscription instanceof DownloadableSubscription ? subscription.lastModified : null,
    expires: subscription instanceof DownloadableSubscription ? subscription.expires : 0,
    getPatterns: function()
    {
      let result = subscription.filters.map(function(filter)
      {
        return filter.text;
      });
      return result;
    }
  };
}
