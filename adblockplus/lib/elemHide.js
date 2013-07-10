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
 * @fileOverview Element hiding implementation.
 */

Cu.import("resource://gre/modules/Services.jsm");

let {Utils} = require("utils");
let {IO} = require("io");
let {Prefs} = require("prefs");
let {ElemHideException} = require("filterClasses");
let {FilterNotifier} = require("filterNotifier");
let {AboutHandler} = require("elemHideHitRegistration");
let {TimeLine} = require("timeline");

/**
 * Lookup table, filters by their associated key
 * @type Object
 */
let filterByKey = {__proto__: null};

/**
 * Lookup table, keys of the filters by filter text
 * @type Object
 */
let keyByFilter = {__proto__: null};

/**
 * Lookup table, keys are known element hiding exceptions
 * @type Object
 */
let knownExceptions = {__proto__: null};

/**
 * Lookup table, lists of element hiding exceptions by selector
 * @type Object
 */
let exceptions = {__proto__: null};

/**
 * Currently applied stylesheet URL
 * @type nsIURI
 */
let styleURL = null;

/**
 * Element hiding component
 * @class
 */
let ElemHide = exports.ElemHide =
{
  /**
   * Indicates whether filters have been added or removed since the last apply() call.
   * @type Boolean
   */
  isDirty: false,

  /**
   * Inidicates whether the element hiding stylesheet is currently applied.
   * @type Boolean
   */
  applied: false,

  /**
   * Called on module startup.
   */
  init: function()
  {
    TimeLine.enter("Entered ElemHide.init()");
    Prefs.addListener(function(name)
    {
      if (name == "enabled")
        ElemHide.apply();
    });
    onShutdown.add(function()
    {
      ElemHide.unapply();
    });

    TimeLine.log("done adding prefs listener");

    let styleFile = IO.resolveFilePath(Prefs.data_directory);
    styleFile.append("elemhide.css");
    styleURL = Services.io.newFileURI(styleFile).QueryInterface(Ci.nsIFileURL);
    TimeLine.log("done determining stylesheet URL");

    TimeLine.leave("ElemHide.init() done");
  },

  /**
   * Removes all known filters
   */
  clear: function()
  {
    filterByKey = {__proto__: null};
    keyByFilter = {__proto__: null};
    knownExceptions = {__proto__: null};
    exceptions = {__proto__: null};
    ElemHide.isDirty = false;
    ElemHide.unapply();
  },

  /**
   * Add a new element hiding filter
   * @param {ElemHideFilter} filter
   */
  add: function(filter)
  {
    if (filter instanceof ElemHideException)
    {
      if (filter.text in knownExceptions)
        return;

      let selector = filter.selector;
      if (!(selector in exceptions))
        exceptions[selector] = [];
      exceptions[selector].push(filter);
      knownExceptions[filter.text] = true;
    }
    else
    {
      if (filter.text in keyByFilter)
        return;

      let key;
      do {
        key = Math.random().toFixed(15).substr(5);
      } while (key in filterByKey);

      filterByKey[key] = filter;
      keyByFilter[filter.text] = key;
      ElemHide.isDirty = true;
    }
  },

  /**
   * Removes an element hiding filter
   * @param {ElemHideFilter} filter
   */
  remove: function(filter)
  {
    if (filter instanceof ElemHideException)
    {
      if (!(filter.text in knownExceptions))
        return;

      let list = exceptions[filter.selector];
      let index = list.indexOf(filter);
      if (index >= 0)
        list.splice(index, 1);
      delete knownExceptions[filter.text];
    }
    else
    {
      if (!(filter.text in keyByFilter))
        return;

      let key = keyByFilter[filter.text];
      delete filterByKey[key];
      delete keyByFilter[filter.text];
      ElemHide.isDirty = true;
    }
  },

  /**
   * Checks whether an exception rule is registered for a filter on a particular
   * domain.
   */
  getException: function(/**Filter*/ filter, /**String*/ docDomain) /**ElemHideException*/
  {
    let selector = filter.selector;
    if (!(filter.selector in exceptions))
      return null;

    let list = exceptions[filter.selector];
    for (let i = list.length - 1; i >= 0; i--)
      if (list[i].isActiveOnDomain(docDomain))
        return list[i];

    return null;
  },

  /**
   * Will be set to true if apply() is running (reentrance protection).
   * @type Boolean
   */
  _applying: false,

  /**
   * Will be set to true if an apply() call arrives while apply() is already
   * running (delayed execution).
   * @type Boolean
   */
  _needsApply: false,

  /**
   * Generates stylesheet URL and applies it globally
   */
  apply: function()
  {
    if (this._applying)
    {
      this._needsApply = true;
      return;
    }

    TimeLine.enter("Entered ElemHide.apply()");

    if (!ElemHide.isDirty || !Prefs.enabled)
    {
      // Nothing changed, looks like we merely got enabled/disabled
      if (Prefs.enabled && !ElemHide.applied)
      {
        try
        {
          Utils.styleService.loadAndRegisterSheet(styleURL, Ci.nsIStyleSheetService.USER_SHEET);
          ElemHide.applied = true;
        }
        catch (e)
        {
          Cu.reportError(e);
        }
        TimeLine.log("Applying existing stylesheet finished");
      }
      else if (!Prefs.enabled && ElemHide.applied)
      {
        ElemHide.unapply();
        TimeLine.log("ElemHide.unapply() finished");
      }

      TimeLine.leave("ElemHide.apply() done (no file changes)");
      return;
    }

    IO.writeToFile(styleURL.file, false, this._generateCSSContent(), function(e)
    {
      TimeLine.enter("ElemHide.apply() write callback");
      this._applying = false;

      if (e && e.result == Cr.NS_ERROR_NOT_AVAILABLE)
        IO.removeFile(styleURL.file, function(e2) {});
      else if (e)
        Cu.reportError(e);

      if (this._needsApply)
      {
        this._needsApply = false;
        this.apply();
      }
      else if (!e || e.result == Cr.NS_ERROR_NOT_AVAILABLE)
      {
        ElemHide.isDirty = false;

        ElemHide.unapply();
        TimeLine.log("ElemHide.unapply() finished");

        if (!e)
        {
          try
          {
            Utils.styleService.loadAndRegisterSheet(styleURL, Ci.nsIStyleSheetService.USER_SHEET);
            ElemHide.applied = true;
          }
          catch (e)
          {
            Cu.reportError(e);
          }
          TimeLine.log("Applying stylesheet finished");
        }

        FilterNotifier.triggerListeners("elemhideupdate");
      }
      TimeLine.leave("ElemHide.apply() write callback done");
    }.bind(this), "ElemHideWrite");

    this._applying = true;

    TimeLine.leave("ElemHide.apply() done", "ElemHideWrite");
  },

  _generateCSSContent: function()
  {
    // Grouping selectors by domains
    TimeLine.log("start grouping selectors");
    let domains = {__proto__: null};
    let hasFilters = false;
    for (let key in filterByKey)
    {
      let filter = filterByKey[key];
      let domain = filter.selectorDomain || "";

      let list;
      if (domain in domains)
        list = domains[domain];
      else
      {
        list = {__proto__: null};
        domains[domain] = list;
      }
      list[filter.selector] = key;
      hasFilters = true;
    }
    TimeLine.log("done grouping selectors");

    if (!hasFilters)
      throw Cr.NS_ERROR_NOT_AVAILABLE;

    function escapeChar(match)
    {
      return "\\" + match.charCodeAt(0).toString(16) + " ";
    }

    // Return CSS data
    let cssTemplate = "-moz-binding: url(about:" + AboutHandler.aboutPrefix + "?%ID%#dummy) !important;";
    for (let domain in domains)
    {
      let rules = [];
      let list = domains[domain];

      if (domain)
        yield ('@-moz-document domain("' + domain.split(",").join('"),domain("') + '"){').replace(/[^\x01-\x7F]/g, escapeChar);
      else
      {
        // Only allow unqualified rules on a few protocols to prevent them from blocking chrome
        yield '@-moz-document url-prefix("http://"),url-prefix("https://"),'
                  + 'url-prefix("mailbox://"),url-prefix("imap://"),'
                  + 'url-prefix("news://"),url-prefix("snews://"){';
      }

      for (let selector in list)
        yield selector.replace(/[^\x01-\x7F]/g, escapeChar) + "{" + cssTemplate.replace("%ID%", list[selector]) + "}";
      yield '}';
    }
  },

  /**
   * Unapplies current stylesheet URL
   */
  unapply: function()
  {
    if (ElemHide.applied)
    {
      try
      {
        Utils.styleService.unregisterSheet(styleURL, Ci.nsIStyleSheetService.USER_SHEET);
      }
      catch (e)
      {
        Cu.reportError(e);
      }
      ElemHide.applied = false;
    }
  },

  /**
   * Retrieves the currently applied stylesheet URL
   * @type String
   */
  get styleURL() ElemHide.applied ? styleURL.spec : null,

  /**
   * Retrieves an element hiding filter by the corresponding protocol key
   */
  getFilterByKey: function(/**String*/ key) /**Filter*/
  {
    return (key in filterByKey ? filterByKey[key] : null);
  },

  /**
   * Returns a list of all selectors active on a particular domain (currently
   * used only in Chrome).
   */
  getSelectorsForDomain: function(/**String*/ domain, /**Boolean*/ specificOnly)
  {
    let result = [];
    for (let key in filterByKey)
    {
      let filter = filterByKey[key];
      if (specificOnly && (!filter.domains || filter.domains[""]))
        continue;

      if (filter.isActiveOnDomain(domain) && !this.getException(filter, domain))
        result.push(filter.selector);
    }
    return result;
  }
};
