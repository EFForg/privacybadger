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
 * @fileOverview Firefox Sync integration
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let {FilterStorage} = require("filterStorage");
let {FilterNotifier} = require("filterNotifier");
let {Synchronizer} = require("synchronizer");
let {Subscription, SpecialSubscription, DownloadableSubscription, ExternalSubscription} = require("subscriptionClasses");
let {Filter, ActiveFilter} = require("filterClasses");

// Firefox Sync classes are set later in initEngine()
let Service, Engines, SyncEngine, Store, Tracker;

/**
 * ID of the only record stored
 * @type String
 */
let filtersRecordID = "6fad6286-8207-46b6-aa39-8e0ce0bd7c49";

let Sync = exports.Sync =
{
  /**
   * Will be set to true if/when Weave starts up.
   * @type Boolean
   */
  initialized: false,

  /**
   * Whether Weave requested us to track changes.
   * @type Boolean
   */
  trackingEnabled: false,

  /**
   * Returns Adblock Plus sync engine.
   * @result Engine
   */
  getEngine: function()
  {
    if (this.initialized)
      return Engines.get("adblockplus");
    else
      return null;
  }
};

/**
 * Listens to notifications from Sync service.
 */
let SyncServiceObserver =
{
  init: function()
  {
    try
    {
      let {Status, STATUS_DISABLED, CLIENT_NOT_CONFIGURED} = Cu.import("resource://services-sync/status.js", null);
      Sync.initialized = Status.ready;
      Sync.trackingEnabled = (Status.service != STATUS_DISABLED && Status.service != CLIENT_NOT_CONFIGURED);
    }
    catch (e)
    {
      return;
    }

    if (Sync.initialized)
      this.initEngine();
    else
      Services.obs.addObserver(this, "weave:service:ready", true);
    Services.obs.addObserver(this, "weave:engine:start-tracking", true);
    Services.obs.addObserver(this, "weave:engine:stop-tracking", true);

    onShutdown.add(function()
    {
      try
      {
        Services.obs.removeObserver(this, "weave:service:ready");
      } catch (e) {}
      Services.obs.removeObserver(this, "weave:engine:start-tracking");
      Services.obs.removeObserver(this, "weave:engine:stop-tracking");
    }.bind(this));
  },

  initEngine: function()
  {
    ({Engines, SyncEngine, Store, Tracker} = Cu.import("resource://services-sync/engines.js"));
    if (typeof Engines == "undefined")
    {
      ({Service} = Cu.import("resource://services-sync/service.js"));
      Engines = Service.engineManager;
    }

    ABPEngine.prototype.__proto__ = SyncEngine.prototype;
    ABPStore.prototype.__proto__ = Store.prototype;
    ABPTracker.prototype.__proto__ = Tracker.prototype;

    Engines.register(ABPEngine);
    onShutdown.add(function()
    {
      Engines.unregister("adblockplus");
    });
  },

  observe: function(subject, topic, data)
  {
    switch (topic)
    {
      case "weave:service:ready":
        if (Sync.initialized)
          return;

        this.initEngine();
        Sync.initialized = true;
        break;
      case "weave:engine:start-tracking":
        Sync.trackingEnabled = true;
        if (trackerInstance)
          trackerInstance.startTracking();
        break;
      case "weave:engine:stop-tracking":
        Sync.trackingEnabled = false;
        if (trackerInstance)
          trackerInstance.stopTracking();
        break;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
};

function ABPEngine()
{
  SyncEngine.call(this, "AdblockPlus", Service);
}
ABPEngine.prototype =
{
  _storeObj: ABPStore,
  _trackerObj: ABPTracker,
  version: 1,

  _reconcile: function(item)
  {
    // Always process server data, we will do the merging ourselves
    return true;
  }
};

function ABPStore(name, engine)
{
  Store.call(this, name, engine);
}
ABPStore.prototype =
{
  getAllIDs: function()
  {
    let result = {}
    result[filtersRecordID] = true;
    return result;
  },

  changeItemID: function(oldId, newId)
  {
    // This should not be called, our engine doesn't implement _findDupe
    throw Cr.NS_ERROR_UNEXPECTED;
  },

  itemExists: function(id)
  {
    // Only one id exists so far
    return (id == filtersRecordID);
  },

  createRecord: function(id, collection)
  {
    let record = new ABPEngine.prototype._recordObj(collection, id);
    if (id == filtersRecordID)
    {
      record.cleartext = {
        id: id,
        subscriptions: [],
      };
      for each (let subscription in FilterStorage.subscriptions)
      {
        if (subscription instanceof ExternalSubscription)
          continue;

        let subscriptionEntry =
        {
          url: subscription.url,
          disabled: subscription.disabled
        };
        if (subscription instanceof SpecialSubscription)
        {
          subscriptionEntry.filters = [];
          for each (let filter in subscription.filters)
          {
            let filterEntry = {text: filter.text};
            if (filter instanceof ActiveFilter)
              filterEntry.disabled = filter.disabled;
            subscriptionEntry.filters.push(filterEntry);
          }
        }
        else
          subscriptionEntry.title = subscription.title;
        record.cleartext.subscriptions.push(subscriptionEntry);
      }

      // Data sent, forget about local changes now
      trackerInstance.clearPrivateChanges()
    }
    else
      record.deleted = true;

    return record;
  },

  create: function(record)
  {
    // This should not be called because our record list doesn't change but
    // call update just in case.
    this.update(record);
  },

  update: function(record)
  {
    if (record.id != filtersRecordID)
      return;

    this._log.trace("Merging in remote data");

    let data = record.cleartext.subscriptions;

    // First make sure we have the same subscriptions on both sides
    let seenSubscription = {__proto__: null};
    for each (let remoteSubscription in data)
    {
      seenSubscription[remoteSubscription.url] = true;
      if (remoteSubscription.url in FilterStorage.knownSubscriptions)
      {
        let subscription = FilterStorage.knownSubscriptions[remoteSubscription.url];
        if (!trackerInstance.didSubscriptionChange(remoteSubscription))
        {
          // Only change local subscription if there were no changes, otherwise dismiss remote changes
          subscription.disabled = remoteSubscription.disabled;
          if (subscription instanceof DownloadableSubscription)
            subscription.title = remoteSubscription.title;
        }
      }
      else if (!trackerInstance.didSubscriptionChange(remoteSubscription))
      {
        // Subscription was added remotely, add it locally as well
        let subscription = Subscription.fromURL(remoteSubscription.url);
        if (!subscription)
          continue;

        subscription.disabled = remoteSubscription.disabled;
        if (subscription instanceof DownloadableSubscription)
        {
          subscription.title = remoteSubscription.title;
          FilterStorage.addSubscription(subscription);
          Synchronizer.execute(subscription);
        }
      }
    }

    for each (let subscription in FilterStorage.subscriptions.slice())
    {
      if (!(subscription.url in seenSubscription) && subscription instanceof DownloadableSubscription && !trackerInstance.didSubscriptionChange(subscription))
      {
        // Subscription was removed remotely, remove it locally as well
        FilterStorage.removeSubscription(subscription);
      }
    }

    // Now sync the custom filters
    let seenFilter = {__proto__: null};
    for each (let remoteSubscription in data)
    {
      if (!("filters" in remoteSubscription))
        continue;

      for each (let remoteFilter in remoteSubscription.filters)
      {
        seenFilter[remoteFilter.text] = true;

        let filter = Filter.fromText(remoteFilter.text);
        if (trackerInstance.didFilterChange(filter))
          continue;

        if (filter.subscriptions.some(function(subscription) subscription instanceof SpecialSubscription))
        {
          // Filter might have been changed remotely
          if (filter instanceof ActiveFilter)
            filter.disabled = remoteFilter.disabled;
        }
        else
        {
          // Filter was added remotely, add it locally as well
          FilterStorage.addFilter(filter);
        }
      }
    }

    for each (let subscription in FilterStorage.subscriptions)
    {
      if (!(subscription instanceof SpecialSubscription))
        continue;

      for each (let filter in subscription.filters.slice())
      {
        if (!(filter.text in seenFilter) && !trackerInstance.didFilterChange(filter))
        {
          // Filter was removed remotely, remove it locally as well
          FilterStorage.removeFilter(filter);
        }
      }
    }

    // Merge done, forget about local changes now
    trackerInstance.clearPrivateChanges()
  },

  remove: function(record)
  {
    // Shouldn't be called but if it is - ignore
  },

  wipe: function()
  {
    this._log.trace("Got wipe command, removing all data");

    for each (let subscription in FilterStorage.subscriptions.slice())
    {
      if (subscription instanceof DownloadableSubscription)
        FilterStorage.removeSubscription(subscription);
      else if (subscription instanceof SpecialSubscription)
      {
        for each (let filter in subscription.filters.slice())
          FilterStorage.removeFilter(filter);
      }
    }

    // Data wiped, forget about local changes now
    trackerInstance.clearPrivateChanges()
  }
};

/**
 * Hack to allow store to use the tracker - store tracker pointer globally.
 */
let trackerInstance = null;

function ABPTracker(name, engine)
{
  Tracker.call(this, name, engine);

  this.privateTracker = new Tracker(name + ".private", engine);
  trackerInstance = this;

  this.onChange = this.onChange.bind(this);

  if (Sync.trackingEnabled)
    this.startTracking();
}
ABPTracker.prototype =
{
  privateTracker: null,

  startTracking: function()
  {
    FilterNotifier.addListener(this.onChange);
  },

  stopTracking: function()
  {
    FilterNotifier.removeListener(this.onChange);
  },

  clearPrivateChanges: function()
  {
    this.privateTracker.clearChangedIDs();
  },

  addPrivateChange: function(id)
  {
    // Ignore changes during syncing
    if (this.ignoreAll)
      return;

    this.addChangedID(filtersRecordID);
    this.privateTracker.addChangedID(id);
    this.score += 10;
  },

  didSubscriptionChange: function(subscription)
  {
    return ("subscription " + subscription.url) in this.privateTracker.changedIDs;
  },

  didFilterChange: function(filter)
  {
    return ("filter " + filter.text) in this.privateTracker.changedIDs;
  },

  onChange: function(action, item)
  {
    switch (action)
    {
      case "subscription.updated":
        if ("oldSubscription" in item)
        {
          // Subscription moved to a new address
          this.addPrivateChange("subscription " + item.url);
          this.addPrivateChange("subscription " + item.oldSubscription.url);
        }
        else if (item instanceof SpecialSubscription)
        {
          // User's filters changed via Preferences window
          for each (let filter in item.filters)
            this.addPrivateChange("filter " + filter.text);
          for each (let filter in item.oldFilters)
            this.addPrivateChange("filter " + filter.text);
        }
        break;
      case "subscription.added":
      case "subscription.removed":
      case "subscription.disabled":
      case "subscription.title":
        this.addPrivateChange("subscription " + item.url);
        break;
      case "filter.added":
      case "filter.removed":
      case "filter.disabled":
        this.addPrivateChange("filter " + item.text);
        break;
    }
  }
};

SyncServiceObserver.init();
