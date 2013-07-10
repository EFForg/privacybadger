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
 * @fileOverview Definition of Subscription class and its subclasses.
 */

Cu.import("resource://gre/modules/Services.jsm");

let {ActiveFilter, BlockingFilter, WhitelistFilter, ElemHideBase} = require("filterClasses");
let {FilterNotifier} = require("filterNotifier");

/**
 * Abstract base class for filter subscriptions
 *
 * @param {String} url    download location of the subscription
 * @param {String} [title]  title of the filter subscription
 * @constructor
 */
function Subscription(url, title)
{
  this.url = url;
  this.filters = [];
  if (title)
    this._title = title;
  else
  {
    let {Utils} = require("utils");
    this._title = Utils.getString("newGroup_title");
  }
  Subscription.knownSubscriptions[url] = this;
}
exports.Subscription = Subscription;

Subscription.prototype =
{
  /**
   * Download location of the subscription
   * @type String
   */
  url: null,

  /**
   * Filters contained in the filter subscription
   * @type Array of Filter
   */
  filters: null,

  _title: null,
  _fixedTitle: false,
  _disabled: false,

  /**
   * Title of the filter subscription
   * @type String
   */
  get title() this._title,
  set title(value)
  {
    if (value != this._title)
    {
      let oldValue = this._title;
      this._title = value;
      FilterNotifier.triggerListeners("subscription.title", this, value, oldValue);
    }
    return this._title;
  },

  /**
   * Determines whether the title should be editable
   * @type Boolean
   */
  get fixedTitle() this._fixedTitle,
  set fixedTitle(value)
  {
    if (value != this._fixedTitle)
    {
      let oldValue = this._fixedTitle;
      this._fixedTitle = value;
      FilterNotifier.triggerListeners("subscription.fixedTitle", this, value, oldValue);
    }
    return this._fixedTitle;
  },

  /**
   * Defines whether the filters in the subscription should be disabled
   * @type Boolean
   */
  get disabled() this._disabled,
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      FilterNotifier.triggerListeners("subscription.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {Array of String} buffer  buffer to push the serialization results into
   */
  serialize: function(buffer)
  {
    buffer.push("[Subscription]");
    buffer.push("url=" + this.url);
    buffer.push("title=" + this._title);
    if (this._fixedTitle)
      buffer.push("fixedTitle=true");
    if (this._disabled)
      buffer.push("disabled=true");
  },

  serializeFilters: function(buffer)
  {
    for each (let filter in this.filters)
      buffer.push(filter.text.replace(/\[/g, "\\["));
  },

  toString: function()
  {
    let buffer = [];
    this.serialize(buffer);
    return buffer.join("\n");
  }
};

/**
 * Cache for known filter subscriptions, maps URL to subscription objects.
 * @type Object
 */
Subscription.knownSubscriptions = {__proto__: null};

/**
 * Returns a subscription from its URL, creates a new one if necessary.
 * @param {String} url  URL of the subscription
 * @return {Subscription} subscription or null if the subscription couldn't be created
 */
Subscription.fromURL = function(url)
{
  if (url in Subscription.knownSubscriptions)
    return Subscription.knownSubscriptions[url];

  try
  {
    // Test URL for validity
    url = Services.io.newURI(url, null, null).spec;
    return new DownloadableSubscription(url, null);
  }
  catch (e)
  {
    return new SpecialSubscription(url);
  }
}

/**
 * Deserializes a subscription
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Subscription} subscription or null if the subscription couldn't be created
 */
Subscription.fromObject = function(obj)
{
  let result;
  try
  {
    obj.url = Services.io.newURI(obj.url, null, null).spec;

    // URL is valid - this is a downloadable subscription
    result = new DownloadableSubscription(obj.url, obj.title);
    if ("nextURL" in obj)
      result.nextURL = obj.nextURL;
    if ("downloadStatus" in obj)
      result._downloadStatus = obj.downloadStatus;
    if ("lastModified" in obj)
      result.lastModified = obj.lastModified;
    if ("lastSuccess" in obj)
      result.lastSuccess = parseInt(obj.lastSuccess) || 0;
    if ("lastCheck" in obj)
      result._lastCheck = parseInt(obj.lastCheck) || 0;
    if ("expires" in obj)
      result.expires = parseInt(obj.expires) || 0;
    if ("softExpiration" in obj)
      result.softExpiration = parseInt(obj.softExpiration) || 0;
    if ("errors" in obj)
      result._errors = parseInt(obj.errors) || 0;
    if ("requiredVersion" in obj)
    {
      let {addonVersion} = require("info");
      result.requiredVersion = obj.requiredVersion;
      if (Services.vc.compare(result.requiredVersion, addonVersion) > 0)
        result.upgradeRequired = true;
    }
    if ("alternativeLocations" in obj)
      result.alternativeLocations = obj.alternativeLocations;
    if ("homepage" in obj)
      result._homepage = obj.homepage;
    if ("lastDownload" in obj)
      result._lastDownload = parseInt(obj.lastDownload) || 0;
  }
  catch (e)
  {
    // Invalid URL - custom filter group
    if (!("title" in obj))
    {
      // Backwards compatibility - titles and filter types were originally
      // determined by group identifier.
      if (obj.url == "~wl~")
        obj.defaults = "whitelist";
      else if (obj.url == "~fl~")
        obj.defaults = "blocking";
      else if (obj.url == "~eh~")
        obj.defaults = "elemhide";
      if ("defaults" in obj)
      {
        let {Utils} = require("utils");
        obj.title = Utils.getString(obj.defaults + "Group_title");
      }
    }
    result = new SpecialSubscription(obj.url, obj.title);
    if ("defaults" in obj)
      result.defaults = obj.defaults.split(" ");
  }
  if ("fixedTitle" in obj)
    result._fixedTitle = (obj.fixedTitle == "true");
  if ("disabled" in obj)
    result._disabled = (obj.disabled == "true");

  return result;
}

/**
 * Class for special filter subscriptions (user's filters)
 * @param {String} url see Subscription()
 * @param {String} [title]  see Subscription()
 * @constructor
 * @augments Subscription
 */
function SpecialSubscription(url, title)
{
  Subscription.call(this, url, title);
}
exports.SpecialSubscription = SpecialSubscription;

SpecialSubscription.prototype =
{
  __proto__: Subscription.prototype,

  /**
   * Filter types that should be added to this subscription by default
   * (entries should correspond to keys in SpecialSubscription.defaultsMap).
   * @type Array of String
   */
  defaults: null,

  /**
   * Tests whether a filter should be added to this group by default
   * @param {Filter} filter filter to be tested
   * @return {Boolean}
   */
  isDefaultFor: function(filter)
  {
    if (this.defaults && this.defaults.length)
    {
      for each (let type in this.defaults)
      {
        if (filter instanceof SpecialSubscription.defaultsMap[type])
          return true;
        if (!(filter instanceof ActiveFilter) && type == "blacklist")
          return true;
      }
    }

    return false;
  },

  /**
   * See Subscription.serialize()
   */
  serialize: function(buffer)
  {
    Subscription.prototype.serialize.call(this, buffer);
    if (this.defaults && this.defaults.length)
      buffer.push("defaults=" + this.defaults.filter(function(type) type in SpecialSubscription.defaultsMap).join(" "));
    if (this._lastDownload)
      buffer.push("lastDownload=" + this._lastDownload);
  }
};

SpecialSubscription.defaultsMap = {
  __proto__: null,
  "whitelist": WhitelistFilter,
  "blocking": BlockingFilter,
  "elemhide": ElemHideBase
};

/**
 * Creates a new user-defined filter group.
 * @param {String} [title]  title of the new filter group
 * @result {SpecialSubscription}
 */
SpecialSubscription.create = function(title)
{
  let url;
  do
  {
    url = "~user~" + Math.round(Math.random()*1000000);
  } while (url in Subscription.knownSubscriptions);
  return new SpecialSubscription(url, title)
};

/**
 * Creates a new user-defined filter group and adds the given filter to it.
 * This group will act as the default group for this filter type.
 */
SpecialSubscription.createForFilter = function(/**Filter*/ filter) /**SpecialSubscription*/
{
  let subscription = SpecialSubscription.create();
  subscription.filters.push(filter);
  for (let type in SpecialSubscription.defaultsMap)
  {
    if (filter instanceof SpecialSubscription.defaultsMap[type])
      subscription.defaults = [type];
  }
  if (!subscription.defaults)
    subscription.defaults = ["blocking"];

  let {Utils} = require("utils");
  subscription.title = Utils.getString(subscription.defaults[0] + "Group_title");
  return subscription;
};

/**
 * Abstract base class for regular filter subscriptions (both internally and externally updated)
 * @param {String} url    see Subscription()
 * @param {String} [title]  see Subscription()
 * @constructor
 * @augments Subscription
 */
function RegularSubscription(url, title)
{
  Subscription.call(this, url, title || url);
}
exports.RegularSubscription = RegularSubscription;

RegularSubscription.prototype =
{
  __proto__: Subscription.prototype,

  _homepage: null,
  _lastDownload: 0,

  /**
   * Filter subscription homepage if known
   * @type String
   */
  get homepage() this._homepage,
  set homepage(value)
  {
    if (value != this._homepage)
    {
      let oldValue = this._homepage;
      this._homepage = value;
      FilterNotifier.triggerListeners("subscription.homepage", this, value, oldValue);
    }
    return this._homepage;
  },

  /**
   * Time of the last subscription download (in seconds since the beginning of the epoch)
   * @type Number
   */
  get lastDownload() this._lastDownload,
  set lastDownload(value)
  {
    if (value != this._lastDownload)
    {
      let oldValue = this._lastDownload;
      this._lastDownload = value;
      FilterNotifier.triggerListeners("subscription.lastDownload", this, value, oldValue);
    }
    return this._lastDownload;
  },

  /**
   * See Subscription.serialize()
   */
  serialize: function(buffer)
  {
    Subscription.prototype.serialize.call(this, buffer);
    if (this._homepage)
      buffer.push("homepage=" + this._homepage);
    if (this._lastDownload)
      buffer.push("lastDownload=" + this._lastDownload);
  }
};

/**
 * Class for filter subscriptions updated by externally (by other extension)
 * @param {String} url    see Subscription()
 * @param {String} [title]  see Subscription()
 * @constructor
 * @augments RegularSubscription
 */
function ExternalSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.ExternalSubscription = ExternalSubscription;

ExternalSubscription.prototype =
{
  __proto__: RegularSubscription.prototype,

  /**
   * See Subscription.serialize()
   */
  serialize: function(buffer)
  {
    throw new Error("Unexpected call, external subscriptions should not be serialized");
  }
};

/**
 * Class for filter subscriptions updated by externally (by other extension)
 * @param {String} url  see Subscription()
 * @param {String} [title]  see Subscription()
 * @constructor
 * @augments RegularSubscription
 */
function DownloadableSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.DownloadableSubscription = DownloadableSubscription;

DownloadableSubscription.prototype =
{
  __proto__: RegularSubscription.prototype,

  _downloadStatus: null,
  _lastCheck: 0,
  _errors: 0,

  /**
   * Next URL the downloaded should be attempted from (in case of redirects)
   * @type String
   */
  nextURL: null,

  /**
   * Status of the last download (ID of a string)
   * @type String
   */
  get downloadStatus() this._downloadStatus,
  set downloadStatus(value)
  {
    let oldValue = this._downloadStatus;
    this._downloadStatus = value;
    FilterNotifier.triggerListeners("subscription.downloadStatus", this, value, oldValue);
    return this._downloadStatus;
  },

  /**
   * Value of the Last-Modified header returned by the server on last download
   * @type String
   */
  lastModified: null,

  /**
   * Time of the last successful download (in seconds since the beginning of the
   * epoch).
   */
  lastSuccess: 0,

  /**
   * Time when the subscription was considered for an update last time (in seconds
   * since the beginning of the epoch). This will be used to increase softExpiration
   * if the user doesn't use Adblock Plus for some time.
   * @type Number
   */
  get lastCheck() this._lastCheck,
  set lastCheck(value)
  {
    if (value != this._lastCheck)
    {
      let oldValue = this._lastCheck;
      this._lastCheck = value;
      FilterNotifier.triggerListeners("subscription.lastCheck", this, value, oldValue);
    }
    return this._lastCheck;
  },

  /**
   * Hard expiration time of the filter subscription (in seconds since the beginning of the epoch)
   * @type Number
   */
  expires: 0,

  /**
   * Soft expiration time of the filter subscription (in seconds since the beginning of the epoch)
   * @type Number
   */
  softExpiration: 0,

  /**
   * Number of download failures since last success
   * @type Number
   */
  get errors() this._errors,
  set errors(value)
  {
    if (value != this._errors)
    {
      let oldValue = this._errors;
      this._errors = value;
      FilterNotifier.triggerListeners("subscription.errors", this, value, oldValue);
    }
    return this._errors;
  },

  /**
   * Minimal Adblock Plus version required for this subscription
   * @type String
   */
  requiredVersion: null,

  /**
   * Should be true if requiredVersion is higher than current Adblock Plus version
   * @type Boolean
   */
  upgradeRequired: false,

  /**
   * Value of the X-Alternative-Locations header: comma-separated list of URLs
   * with their weighting factors, e.g.: http://foo.example.com/;q=0.5,http://bar.example.com/;q=2
   * @type String
   */
  alternativeLocations: null,

  /**
   * See Subscription.serialize()
   */
  serialize: function(buffer)
  {
    RegularSubscription.prototype.serialize.call(this, buffer);
    if (this.nextURL)
      buffer.push("nextURL=" + this.nextURL);
    if (this.downloadStatus)
      buffer.push("downloadStatus=" + this.downloadStatus);
    if (this.lastModified)
      buffer.push("lastModified=" + this.lastModified);
    if (this.lastSuccess)
      buffer.push("lastSuccess=" + this.lastSuccess);
    if (this.lastCheck)
      buffer.push("lastCheck=" + this.lastCheck);
    if (this.expires)
      buffer.push("expires=" + this.expires);
    if (this.softExpiration)
      buffer.push("softExpiration=" + this.softExpiration);
    if (this.errors)
      buffer.push("errors=" + this.errors);
    if (this.requiredVersion)
      buffer.push("requiredVersion=" + this.requiredVersion);
    if (this.alternativeLocations)
      buffer.push("alternativeLocations=" + this.alternativeLocations);
  }
};
