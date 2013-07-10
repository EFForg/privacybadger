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
 * @fileOverview Component synchronizing filter storage with Matcher instances and ElemHide.
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let {TimeLine} = require("timeline");
let {FilterStorage} = require("filterStorage");
let {FilterNotifier} = require("filterNotifier");
let {ElemHide} = require("elemHide");
let {defaultMatcher} = require("matcher");
let {ActiveFilter, RegExpFilter, ElemHideBase} = require("filterClasses");
let {Prefs} = require("prefs");

/**
 * Value of the FilterListener.batchMode property.
 * @type Boolean
 */
let batchMode = false;

/**
 * Increases on filter changes, filters will be saved if it exceeds 1.
 * @type Integer
 */
let isDirty = 0;

/**
 * This object can be used to change properties of the filter change listeners.
 * @class
 */
let FilterListener = exports.FilterListener =
{
  /**
   * Set to true when executing many changes, changes will only be fully applied after this variable is set to false again.
   * @type Boolean
   */
  get batchMode()
  {
    return batchMode;
  },
  set batchMode(value)
  {
    batchMode = value;
    flushElemHide();
  },

  /**
   * Increases "dirty factor" of the filters and calls FilterStorage.saveToDisk()
   * if it becomes 1 or more. Save is executed delayed to prevent multiple
   * subsequent calls. If the parameter is 0 it forces saving filters if any
   * changes were recorded after the previous save.
   */
  setDirty: function(/**Integer*/ factor)
  {
    if (factor == 0 && isDirty > 0)
      isDirty = 1;
    else
      isDirty += factor;
    if (isDirty >= 1)
      FilterStorage.saveToDisk();
  }
};

/**
 * Observer listening to history purge actions.
 * @class
 */
let HistoryPurgeObserver =
{
  observe: function(subject, topic, data)
  {
    if (topic == "browser:purge-session-history" && Prefs.clearStatsOnHistoryPurge)
    {
      FilterStorage.resetHitCounts();
      FilterListener.setDirty(0); // Force saving to disk

      Prefs.recentReports = [];
    }
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

/**
 * Initializes filter listener on startup, registers the necessary hooks.
 */
function init()
{
  TimeLine.enter("Entered filter listener initialization()");

  FilterNotifier.addListener(function(action, item, newValue, oldValue)
  {
    let match = /^(\w+)\.(.*)/.exec(action);
    if (match && match[1] == "filter")
      onFilterChange(match[2], item, newValue, oldValue);
    else if (match && match[1] == "subscription")
      onSubscriptionChange(match[2], item, newValue, oldValue);
    else
      onGenericChange(action, item);
  });

  if ("nsIStyleSheetService" in Ci)
    ElemHide.init();
  else
    flushElemHide = function() {};    // No global stylesheet in Chrome & Co.
  FilterStorage.loadFromDisk();

  TimeLine.log("done initializing data structures");

  Services.obs.addObserver(HistoryPurgeObserver, "browser:purge-session-history", true);
  onShutdown.add(function()
  {
    Services.obs.removeObserver(HistoryPurgeObserver, "browser:purge-session-history");
  });
  TimeLine.log("done adding observers");

  TimeLine.leave("Filter listener initialization done");
}
init();

/**
 * Calls ElemHide.apply() if necessary.
 */
function flushElemHide()
{
  if (!batchMode && ElemHide.isDirty)
    ElemHide.apply();
}

/**
 * Notifies Matcher instances or ElemHide object about a new filter
 * if necessary.
 * @param {Filter} filter filter that has been added
 */
function addFilter(filter)
{
  if (!(filter instanceof ActiveFilter) || filter.disabled)
    return;

  let hasEnabled = false;
  for (let i = 0; i < filter.subscriptions.length; i++)
    if (!filter.subscriptions[i].disabled)
      hasEnabled = true;
  if (!hasEnabled)
    return;

  if (filter instanceof RegExpFilter)
    defaultMatcher.add(filter);
  else if (filter instanceof ElemHideBase)
    ElemHide.add(filter);
}

/**
 * Notifies Matcher instances or ElemHide object about removal of a filter
 * if necessary.
 * @param {Filter} filter filter that has been removed
 */
function removeFilter(filter)
{
  if (!(filter instanceof ActiveFilter))
    return;

  if (!filter.disabled)
  {
    let hasEnabled = false;
    for (let i = 0; i < filter.subscriptions.length; i++)
      if (!filter.subscriptions[i].disabled)
        hasEnabled = true;
    if (hasEnabled)
      return;
  }

  if (filter instanceof RegExpFilter)
    defaultMatcher.remove(filter);
  else if (filter instanceof ElemHideBase)
    ElemHide.remove(filter);
}

/**
 * Subscription change listener
 */
function onSubscriptionChange(action, subscription, newValue, oldValue)
{
  FilterListener.setDirty(1);

  if (action != "added" && action != "removed" && action != "disabled" && action != "updated")
    return;

  if (action != "removed" && !(subscription.url in FilterStorage.knownSubscriptions))
  {
    // Ignore updates for subscriptions not in the list
    return;
  }

  if ((action == "added" || action == "removed" || action == "updated") && subscription.disabled)
  {
    // Ignore adding/removing/updating of disabled subscriptions
    return;
  }

  if (action == "added" || action == "removed" || action == "disabled")
  {
    let method = (action == "added" || (action == "disabled" && newValue == false) ? addFilter : removeFilter);
    if (subscription.filters)
      subscription.filters.forEach(method);
  }
  else if (action == "updated")
  {
    subscription.oldFilters.forEach(removeFilter);
    subscription.filters.forEach(addFilter);
  }

  flushElemHide();
}

/**
 * Filter change listener
 */
function onFilterChange(action, filter, newValue, oldValue)
{
  if (action == "hitCount" || action == "lastHit")
    FilterListener.setDirty(0.002);
  else
    FilterListener.setDirty(1);

  if (action != "added" && action != "removed" && action != "disabled")
    return;

  if ((action == "added" || action == "removed") && filter.disabled)
  {
    // Ignore adding/removing of disabled filters
    return;
  }

  if (action == "added" || (action == "disabled" && newValue == false))
    addFilter(filter);
  else
    removeFilter(filter);
  flushElemHide();
}

/**
 * Generic notification listener
 */
function onGenericChange(action)
{
  if (action == "load")
  {
    isDirty = 0;

    defaultMatcher.clear();
    ElemHide.clear();
    for each (let subscription in FilterStorage.subscriptions)
      if (!subscription.disabled)
        subscription.filters.forEach(addFilter);
    flushElemHide();
  }
  else if (action == "save")
    isDirty = 0;
}
