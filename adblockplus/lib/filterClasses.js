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
 * @fileOverview Definition of Filter class and its subclasses.
 */

let {FilterNotifier} = require("filterNotifier");

/**
 * Abstract base class for filters
 *
 * @param {String} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;
  this.subscriptions = [];
}
exports.Filter = Filter;

Filter.prototype =
{
  /**
   * String representation of the filter
   * @type String
   */
  text: null,

  /**
   * Filter subscriptions the filter belongs to
   * @type Array of Subscription
   */
  subscriptions: null,

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {Array of String} buffer  buffer to push the serialization results into
   */
  serialize: function(buffer)
  {
    buffer.push("[Filter]");
    buffer.push("text=" + this.text);
  },

  toString: function()
  {
    return this.text;
  }
};

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type Object
 */
Filter.knownFilters = {__proto__: null};

/**
 * Regular expression that element hiding filters should match
 * @type RegExp
 */
Filter.elemhideRegExp = /^([^\/\*\|\@"!]*?)#(\@)?(?:([\w\-]+|\*)((?:\([\w\-]+(?:[$^*]?=[^\(\)"]*)?\))*)|#([^{}]+))$/;
/**
 * Regular expression that RegExp filters specified as RegExps should match
 * @type RegExp
 */
Filter.regexpRegExp = /^(@@)?\/.*\/(?:\$~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*)?$/;
/**
 * Regular expression that options on a RegExp filter should match
 * @type RegExp
 */
Filter.optionsRegExp = /\$(~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*)$/;

/**
 * Creates a filter of correct type from its text representation - does the basic parsing and
 * calls the right constructor then.
 *
 * @param {String} text   as in Filter()
 * @return {Filter}
 */
Filter.fromText = function(text)
{
  if (text in Filter.knownFilters)
    return Filter.knownFilters[text];

  let ret;
  let match = (text.indexOf("#") >= 0 ? Filter.elemhideRegExp.exec(text) : null);
  if (match)
    ret = ElemHideBase.fromText(text, match[1], match[2], match[3], match[4], match[5]);
  else if (text[0] == "!")
    ret = new CommentFilter(text);
  else
    ret = RegExpFilter.fromText(text);

  Filter.knownFilters[ret.text] = ret;
  return ret;
}

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromObject = function(obj)
{
  let ret = Filter.fromText(obj.text);
  if (ret instanceof ActiveFilter)
  {
    if ("disabled" in obj)
      ret._disabled = (obj.disabled == "true");
    if ("hitCount" in obj)
      ret._hitCount = parseInt(obj.hitCount) || 0;
    if ("lastHit" in obj)
      ret._lastHit = parseInt(obj.lastHit) || 0;
  }
  return ret;
}

/**
 * Removes unnecessary whitespaces from filter text, will only return null if
 * the input parameter is null.
 */
Filter.normalize = function(/**String*/ text) /**String*/
{
  if (!text)
    return text;

  // Remove line breaks and such
  text = text.replace(/[^\S ]/g, "");

  if (/^\s*!/.test(text))
  {
    // Don't remove spaces inside comments
    return text.replace(/^\s+/, "").replace(/\s+$/, "");
  }
  else if (Filter.elemhideRegExp.test(text))
  {
    // Special treatment for element hiding filters, right side is allowed to contain spaces
    let [, domain, separator, selector] = /^(.*?)(#\@?#?)(.*)$/.exec(text);
    return domain.replace(/\s/g, "") + separator + selector.replace(/^\s+/, "").replace(/\s+$/, "");
  }
  else
    return text.replace(/\s/g, "");
}

/**
 * Class for invalid filters
 * @param {String} text see Filter()
 * @param {String} reason Reason why this filter is invalid
 * @constructor
 * @augments Filter
 */
function InvalidFilter(text, reason)
{
  Filter.call(this, text);

  this.reason = reason;
}
exports.InvalidFilter = InvalidFilter;

InvalidFilter.prototype =
{
  __proto__: Filter.prototype,

  /**
   * Reason why this filter is invalid
   * @type String
   */
  reason: null,

  /**
   * See Filter.serialize()
   */
  serialize: function(buffer) {}
};

/**
 * Class for comments
 * @param {String} text see Filter()
 * @constructor
 * @augments Filter
 */
function CommentFilter(text)
{
  Filter.call(this, text);
}
exports.CommentFilter = CommentFilter;

CommentFilter.prototype =
{
  __proto__: Filter.prototype,

  /**
   * See Filter.serialize()
   */
  serialize: function(buffer) {}
};

/**
 * Abstract base class for filters that can get hits
 * @param {String} text see Filter()
 * @param {String} domains  (optional) Domains that the filter is restricted to separated by domainSeparator e.g. "foo.com|bar.com|~baz.com"
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  this.domainSource = domains;
}
exports.ActiveFilter = ActiveFilter;

ActiveFilter.prototype =
{
  __proto__: Filter.prototype,

  _disabled: false,
  _hitCount: 0,
  _lastHit: 0,

  /**
   * Defines whether the filter is disabled
   * @type Boolean
   */
  get disabled() this._disabled,
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      FilterNotifier.triggerListeners("filter.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Number of hits on the filter since the last reset
   * @type Number
   */
  get hitCount() this._hitCount,
  set hitCount(value)
  {
    if (value != this._hitCount)
    {
      let oldValue = this._hitCount;
      this._hitCount = value;
      FilterNotifier.triggerListeners("filter.hitCount", this, value, oldValue);
    }
    return this._hitCount;
  },

  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the epoch)
   * @type Number
   */
  get lastHit() this._lastHit,
  set lastHit(value)
  {
    if (value != this._lastHit)
    {
      let oldValue = this._lastHit;
      this._lastHit = value;
      FilterNotifier.triggerListeners("filter.lastHit", this, value, oldValue);
    }
    return this._lastHit;
  },

  /**
   * String that the domains property should be generated from
   * @type String
   */
  domainSource: null,

  /**
   * Separator character used in domainSource property, must be overridden by subclasses
   * @type String
   */
  domainSeparator: null,

  /**
   * Determines whether the trailing dot in domain names isn't important and
   * should be ignored, must be overridden by subclasses.
   * @type Boolean
   */
  ignoreTrailingDot: true,

  /**
   * Map containing domains that this filter should match on/not match on or null if the filter should match on all domains
   * @type Object
   */
  get domains()
  {
    let domains = null;

    if (this.domainSource)
    {
      let list = this.domainSource.split(this.domainSeparator);
      if (list.length == 1 && list[0][0] != "~")
      {
        // Fast track for the common one-domain scenario
        domains = {__proto__: null, "": false};
        if (this.ignoreTrailingDot)
          list[0] = list[0].replace(/\.+$/, "");
        domains[list[0]] = true;
      }
      else
      {
        let hasIncludes = false;
        for (let i = 0; i < list.length; i++)
        {
          let domain = list[i];
          if (this.ignoreTrailingDot)
            domain = domain.replace(/\.+$/, "");
          if (domain == "")
            continue;

          let include;
          if (domain[0] == "~")
          {
            include = false;
            domain = domain.substr(1);
          }
          else
          {
            include = true;
            hasIncludes = true;
          }

          if (!domains)
            domains = {__proto__: null};

          domains[domain] = include;
        }
        domains[""] = !hasIncludes;
      }

      delete this.domainSource;
    }

    this.__defineGetter__("domains", function() domains);
    return this.domains;
  },

  /**
   * Checks whether this filter is active on a domain.
   */
  isActiveOnDomain: function(/**String*/ docDomain) /**Boolean*/
  {
    // If no domains are set the rule matches everywhere
    if (!this.domains)
      return true;

    // If the document has no host name, match only if the filter isn't restricted to specific domains
    if (!docDomain)
      return this.domains[""];

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    while (true)
    {
      if (docDomain in this.domains)
        return this.domains[docDomain];

      let nextDot = docDomain.indexOf(".");
      if (nextDot < 0)
        break;
      docDomain = docDomain.substr(nextDot + 1);
    }
    return this.domains[""];
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   */
  isActiveOnlyOnDomain: function(/**String*/ docDomain) /**Boolean*/
  {
    if (!docDomain || !this.domains || this.domains[""])
      return false;

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    for (let domain in this.domains)
      if (this.domains[domain] && domain != docDomain && (domain.length <= docDomain.length || domain.indexOf("." + docDomain) != domain.length - docDomain.length - 1))
        return false;

    return true;
  },

  /**
   * See Filter.serialize()
   */
  serialize: function(buffer)
  {
    if (this._disabled || this._hitCount || this._lastHit)
    {
      Filter.prototype.serialize.call(this, buffer);
      if (this._disabled)
        buffer.push("disabled=true");
      if (this._hitCount)
        buffer.push("hitCount=" + this._hitCount);
      if (this._lastHit)
        buffer.push("lastHit=" + this._lastHit);
    }
  }
};

/**
 * Abstract base class for RegExp-based filters
 * @param {String} text see Filter()
 * @param {String} regexpSource filter part that the regular expression should be build from
 * @param {Number} contentType  (optional) Content types the filter applies to, combination of values from RegExpFilter.typeMap
 * @param {Boolean} matchCase   (optional) Defines whether the filter should distinguish between lower and upper case letters
 * @param {String} domains      (optional) Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
 * @param {Boolean} thirdParty  (optional) Defines whether the filter should apply to third-party or first-party content only
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexpSource, contentType, matchCase, domains, thirdParty)
{
  ActiveFilter.call(this, text, domains);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;

  if (regexpSource.length >= 2 && regexpSource[0] == "/" && regexpSource[regexpSource.length - 1] == "/")
  {
    // The filter is a regular expression - convert it immediately to catch syntax errors
    let regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2), this.matchCase ? "" : "i");
    this.__defineGetter__("regexp", function() regexp);
  }
  else
  {
    // No need to convert this filter to regular expression yet, do it on demand
    this.regexpSource = regexpSource;
  }
}
exports.RegExpFilter = RegExpFilter;

RegExpFilter.prototype =
{
  __proto__: ActiveFilter.prototype,

  /**
   * Number of filters contained, will always be 1 (required to optimize Matcher).
   * @type Integer
   */
  length: 1,

  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: "|",

  /**
   * Expression from which a regular expression should be generated - for delayed creation of the regexp property
   * @type String
   */
  regexpSource: null,
  /**
   * Regular expression to be used when testing against this filter
   * @type RegExp
   */
  get regexp()
  {
    // Remove multiple wildcards
    let source = this.regexpSource.replace(/\*+/g, "*");

    // Remove leading wildcards
    if (source[0] == "*")
      source = source.substr(1);

    // Remove trailing wildcards
    let pos = source.length - 1;
    if (pos >= 0 && source[pos] == "*")
      source = source.substr(0, pos);

    source = source.replace(/\^\|$/, "^")       // remove anchors following separator placeholder
                   .replace(/\W/g, "\\$&")    // escape special symbols
                   .replace(/\\\*/g, ".*")      // replace wildcards by .*
                   // process separator placeholders (all ANSI charaters but alphanumeric characters and _%.-)
                   .replace(/\\\^/g, "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x80]|$)")
                   .replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^.\\/]+\\.)*?") // process extended anchor at expression start
                   .replace(/^\\\|/, "^")       // process anchor at expression start
                   .replace(/\\\|$/, "$");      // process anchor at expression end

    let regexp = new RegExp(source, this.matchCase ? "" : "i");

    delete this.regexpSource;
    this.__defineGetter__("regexp", function() regexp);
    return this.regexp;
  },
  /**
   * Content types the filter applies to, combination of values from RegExpFilter.typeMap
   * @type Number
   */
  contentType: 0x7FFFFFFF,
  /**
   * Defines whether the filter should distinguish between lower and upper case letters
   * @type Boolean
   */
  matchCase: false,
  /**
   * Defines whether the filter should apply to third-party or first-party content only. Can be null (apply to all content).
   * @type Boolean
   */
  thirdParty: null,

  /**
   * Tests whether the URL matches this filter
   * @param {String} location URL to be tested
   * @param {String} contentType content type identifier of the URL
   * @param {String} docDomain domain name of the document that loads the URL
   * @param {Boolean} thirdParty should be true if the URL is a third-party request
   * @return {Boolean} true in case of a match
   */
  matches: function(location, contentType, docDomain, thirdParty)
  {
    if (this.regexp.test(location) &&
        (RegExpFilter.typeMap[contentType] & this.contentType) != 0 &&
        (this.thirdParty == null || this.thirdParty == thirdParty) &&
        this.isActiveOnDomain(docDomain))
    {
      return true;
    }

    return false;
  }
};

RegExpFilter.prototype.__defineGetter__("0", function()
{
  return this;
});

/**
 * Creates a RegExp filter from its text representation
 * @param {String} text   same as in Filter()
 */
RegExpFilter.fromText = function(text)
{
  let blocking = true;
  let origText = text;
  if (text.indexOf("@@") == 0)
  {
    blocking = false;
    text = text.substr(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let siteKeys = null;
  let thirdParty = null;
  let collapse = null;
  let options;
  let match = (text.indexOf("$") >= 0 ? Filter.optionsRegExp.exec(text) : null);
  if (match)
  {
    options = match[1].toUpperCase().split(",");
    text = match.input.substr(0, match.index);
    for each (let option in options)
    {
      let value = null;
      let separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0)
      {
        value = option.substr(separatorIndex + 1);
        option = option.substr(0, separatorIndex);
      }
      option = option.replace(/-/, "_");
      if (option in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = 0;
        contentType |= RegExpFilter.typeMap[option];
      }
      else if (option[0] == "~" && option.substr(1) in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = RegExpFilter.prototype.contentType;
        contentType &= ~RegExpFilter.typeMap[option.substr(1)];
      }
      else if (option == "MATCH_CASE")
        matchCase = true;
      else if (option == "DOMAIN" && typeof value != "undefined")
        domains = value;
      else if (option == "THIRD_PARTY")
        thirdParty = true;
      else if (option == "~THIRD_PARTY")
        thirdParty = false;
      else if (option == "COLLAPSE")
        collapse = true;
      else if (option == "~COLLAPSE")
        collapse = false;
      else if (option == "SITEKEY" && typeof value != "undefined")
        siteKeys = value.split(/\|/);
    }
  }

  if (!blocking && (contentType == null || (contentType & RegExpFilter.typeMap.DOCUMENT)) &&
      (!options || options.indexOf("DOCUMENT") < 0) && !/^\|?[\w\-]+:/.test(text))
  {
    // Exception filters shouldn't apply to pages by default unless they start with a protocol name
    if (contentType == null)
      contentType = RegExpFilter.prototype.contentType;
    contentType &= ~RegExpFilter.typeMap.DOCUMENT;
  }
  if (!blocking && siteKeys)
    contentType = RegExpFilter.typeMap.DOCUMENT;

  try
  {
    if (blocking)
      return new BlockingFilter(origText, text, contentType, matchCase, domains, thirdParty, collapse);
    else
      return new WhitelistFilter(origText, text, contentType, matchCase, domains, thirdParty, siteKeys);
  }
  catch (e)
  {
    return new InvalidFilter(text, e);
  }
}

/**
 * Maps type strings like "SCRIPT" or "OBJECT" to bit masks
 */
RegExpFilter.typeMap = {
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  DOCUMENT: 64,
  XBL: 1,
  PING: 1,
  XMLHTTPREQUEST: 2048,
  OBJECT_SUBREQUEST: 4096,
  DTD: 1,
  MEDIA: 16384,
  FONT: 32768,

  BACKGROUND: 4,    // Backwards compat, same as IMAGE

  POPUP: 0x10000000,
  DONOTTRACK: 0x20000000,
  ELEMHIDE: 0x40000000
};

// ELEMHIDE, DONOTTRACK, POPUP option shouldn't be there by default
RegExpFilter.prototype.contentType &= ~(RegExpFilter.typeMap.ELEMHIDE | RegExpFilter.typeMap.DONOTTRACK | RegExpFilter.typeMap.POPUP);

/**
 * Class for blocking filters
 * @param {String} text see Filter()
 * @param {String} regexpSource see RegExpFilter()
 * @param {Number} contentType see RegExpFilter()
 * @param {Boolean} matchCase see RegExpFilter()
 * @param {String} domains see RegExpFilter()
 * @param {Boolean} thirdParty see RegExpFilter()
 * @param {Boolean} collapse  defines whether the filter should collapse blocked content, can be null
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexpSource, contentType, matchCase, domains, thirdParty, collapse)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains, thirdParty);

  this.collapse = collapse;
}
exports.BlockingFilter = BlockingFilter;

BlockingFilter.prototype =
{
  __proto__: RegExpFilter.prototype,

  /**
   * Defines whether the filter should collapse blocked content. Can be null (use the global preference).
   * @type Boolean
   */
  collapse: null
};

/**
 * Class for whitelist filters
 * @param {String} text see Filter()
 * @param {String} regexpSource see RegExpFilter()
 * @param {Number} contentType see RegExpFilter()
 * @param {Boolean} matchCase see RegExpFilter()
 * @param {String} domains see RegExpFilter()
 * @param {Boolean} thirdParty see RegExpFilter()
 * @param {String[]} siteKeys public keys of websites that this filter should apply to
 * @constructor
 * @augments RegExpFilter
 */
function WhitelistFilter(text, regexpSource, contentType, matchCase, domains, thirdParty, siteKeys)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains, thirdParty);

  if (siteKeys != null)
    this.siteKeys = siteKeys;
}
exports.WhitelistFilter = WhitelistFilter;

WhitelistFilter.prototype =
{
  __proto__: RegExpFilter.prototype,

  /**
   * List of public keys of websites that this filter should apply to
   * @type String[]
   */
  siteKeys: null
}

/**
 * Base class for element hiding filters
 * @param {String} text see Filter()
 * @param {String} domains    (optional) Host names or domains the filter should be restricted to
 * @param {String} selector   CSS selector for the HTML elements that should be hidden
 * @constructor
 * @augments ActiveFilter
 */
function ElemHideBase(text, domains, selector)
{
  ActiveFilter.call(this, text, domains ? domains.toUpperCase() : null);

  if (domains)
    this.selectorDomain = domains.replace(/,~[^,]+/g, "").replace(/^~[^,]+,?/, "").toLowerCase();
  this.selector = selector;
}
exports.ElemHideBase = ElemHideBase;

ElemHideBase.prototype =
{
  __proto__: ActiveFilter.prototype,

  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: ",",

  /**
   * @see ActiveFilter.ignoreTrailingDot
   */
  ignoreTrailingDot: false,

  /**
   * Host name or domain the filter should be restricted to (can be null for no restriction)
   * @type String
   */
  selectorDomain: null,
  /**
   * CSS selector for the HTML elements that should be hidden
   * @type String
   */
  selector: null
};

/**
 * Creates an element hiding filter from a pre-parsed text representation
 *
 * @param {String} text       same as in Filter()
 * @param {String} domain     domain part of the text representation (can be empty)
 * @param {String} tagName    tag name part (can be empty)
 * @param {String} attrRules  attribute matching rules (can be empty)
 * @param {String} selector   raw CSS selector (can be empty)
 * @return {ElemHideFilter|ElemHideException|InvalidFilter}
 */
ElemHideBase.fromText = function(text, domain, isException, tagName, attrRules, selector)
{
  if (!selector)
  {
    if (tagName == "*")
      tagName = "";

    let id = null;
    let additional = "";
    if (attrRules) {
      attrRules = attrRules.match(/\([\w\-]+(?:[$^*]?=[^\(\)"]*)?\)/g);
      for each (let rule in attrRules) {
        rule = rule.substr(1, rule.length - 2);
        let separatorPos = rule.indexOf("=");
        if (separatorPos > 0) {
          rule = rule.replace(/=/, '="') + '"';
          additional += "[" + rule + "]";
        }
        else {
          if (id)
          {
            let {Utils} = require("utils");
            return new InvalidFilter(text, Utils.getString("filter_elemhide_duplicate_id"));
          }
          else
            id = rule;
        }
      }
    }

    if (id)
      selector = tagName + "." + id + additional + "," + tagName + "#" + id + additional;
    else if (tagName || additional)
      selector = tagName + additional;
    else
    {
      let {Utils} = require("utils");
      return new InvalidFilter(text, Utils.getString("filter_elemhide_nocriteria"));
    }
  }
  if (isException)
    return new ElemHideException(text, domain, selector);
  else
    return new ElemHideFilter(text, domain, selector);
}

/**
 * Class for element hiding filters
 * @param {String} text see Filter()
 * @param {String} domains  see ElemHideBase()
 * @param {String} selector see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideFilter = ElemHideFilter;

ElemHideFilter.prototype =
{
  __proto__: ElemHideBase.prototype
};

/**
 * Class for element hiding exceptions
 * @param {String} text see Filter()
 * @param {String} domains  see ElemHideBase()
 * @param {String} selector see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideException(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideException = ElemHideException;

ElemHideException.prototype =
{
  __proto__: ElemHideBase.prototype
};
