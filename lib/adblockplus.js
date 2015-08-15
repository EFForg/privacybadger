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

//
// This file has been generated automatically, relevant repositories:
// * https://hg.adblockplus.org/adblockplus/
// * https://hg.adblockplus.org/jshydra/
//

require.scopes["info"] = (function()
{
  var exports = {};
  exports.__defineGetter__("addonID", function()
  {
    return chrome.i18n.getMessage("@@extension_id");
  });
  exports.addonVersion = "2.1";
  exports.__defineGetter__("addonName", function()
  {
    return chrome.i18n.getMessage("name");
  });
  exports.addonRoot = "";
  exports.application = "chrome";
  return exports;
})();
require.scopes["prefs"] = (function()
{
  var exports = {};
  var Prefs = exports.Prefs =
  {
    enabled: true,
    patternsfile: "patterns.ini",
    patternsbackups: 5,
    patternsbackupinterval: 24,
    data_directory: "",
    savestats: false,
    privateBrowsing: false,
    subscriptions_fallbackerrors: 5,
    subscriptions_fallbackurl: "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&channelStatus=%CHANNELSTATUS%&responseStatus=%RESPONSESTATUS%",
    subscriptions_autoupdate: true,
    documentation_link: "https://adblockplus.org/redirect?link=%LINK%&lang=%LANG%",
    addListener: function(){}
  };
  return exports;
})();
require.scopes["elemHideHitRegistration"] = (function()
{
  var exports = {};
  var AboutHandler = exports.AboutHandler = {};
  return exports;
})();
require.scopes["filterNotifier"] = (function()
{
  var exports = {};
  var listeners = [];
  var FilterNotifier = exports.FilterNotifier =
  {
    addListener: function(listener)
    {
      if (listeners.indexOf(listener) >= 0)
      {
        return;
      }
      listeners.push(listener);
    },
    removeListener: function(listener)
    {
      var index = listeners.indexOf(listener);
      if (index >= 0)
      {
        listeners.splice(index, 1);
      }
    },
    triggerListeners: function(action, item, param1, param2, param3)
    {
      for (var _loopIndex0 = 0; _loopIndex0 < listeners.length; ++_loopIndex0)
      {
        var listener = listeners[_loopIndex0];
        listener(action, item, param1, param2, param3);
      }
    }
  };
  return exports;
})();
require.scopes["filterClasses"] = (function()
{
  var exports = {};
  var FilterNotifier = require("filterNotifier").FilterNotifier;

  function Filter(text)
  {
    this.text = text;
    this.subscriptions = [];
  }
  exports.Filter = Filter;
  Filter.prototype =
  {
    text: null,
    subscriptions: null,
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
  Filter.knownFilters =
  {
    __proto__: null
  };
  Filter.elemhideRegExp = /^([^\/\*\|\@"!]*?)#(\@)?(?:([\w\-]+|\*)((?:\([\w\-]+(?:[$^*]?=[^\(\)"]*)?\))*)|#([^{}]+))$/;
  Filter.regexpRegExp = /^(@@)?\/.*\/(?:\$~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*)?$/;
  Filter.optionsRegExp = /\$(~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*)$/;
  Filter.fromText = function(text)
  {
    if (text in Filter.knownFilters)
    {
      return Filter.knownFilters[text];
    }
    var ret;
    var match = text.indexOf("#") >= 0 ? Filter.elemhideRegExp.exec(text) : null;
    if (match)
    {
      ret = ElemHideBase.fromText(text, match[1], match[2], match[3], match[4], match[5]);
    }
    else if (text[0] == "!")
    {
      ret = new CommentFilter(text);
    }
    else
    {
      ret = RegExpFilter.fromText(text);
    }
    Filter.knownFilters[ret.text] = ret;
    return ret;
  };
  Filter.fromObject = function(obj)
  {
    var ret = Filter.fromText(obj.text);
    if (ret instanceof ActiveFilter)
    {
      if ("disabled" in obj)
      {
        ret._disabled = obj.disabled == "true";
      }
      if ("hitCount" in obj)
      {
        ret._hitCount = parseInt(obj.hitCount) || 0;
      }
      if ("lastHit" in obj)
      {
        ret._lastHit = parseInt(obj.lastHit) || 0;
      }
    }
    return ret;
  };
  Filter.normalize = function(text)
  {
    if (!text)
    {
      return text;
    }
    text = text.replace(/[^\S ]/g, "");
    if (/^\s*!/.test(text))
    {
      return text.replace(/^\s+/, "").replace(/\s+$/, "");
    }
    else if (Filter.elemhideRegExp.test(text))
    {
      var _tempVar1 = /^(.*?)(#\@?#?)(.*)$/.exec(text);
      var domain = _tempVar1[1];
      var separator = _tempVar1[2];
      var selector = _tempVar1[3];
      return domain.replace(/\s/g, "") + separator + selector.replace(/^\s+/, "").replace(/\s+$/, "");
    }
    else
    {
      return text.replace(/\s/g, "");
    }
  };

  function InvalidFilter(text, reason)
  {
    Filter.call(this, text);
    this.reason = reason;
  }
  exports.InvalidFilter = InvalidFilter;
  InvalidFilter.prototype =
  {
    __proto__: Filter.prototype,
    reason: null,
    serialize: function(buffer){}
  };

  function CommentFilter(text)
  {
    Filter.call(this, text);
  }
  exports.CommentFilter = CommentFilter;
  CommentFilter.prototype =
  {
    __proto__: Filter.prototype,
    serialize: function(buffer){}
  };

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
    get disabled()
    {
      return this._disabled;
    },
    set disabled(value)
    {
      if (value != this._disabled)
      {
        var oldValue = this._disabled;
        this._disabled = value;
        FilterNotifier.triggerListeners("filter.disabled", this, value, oldValue);
      }
      return this._disabled;
    },
    get hitCount()
    {
      return this._hitCount;
    },
    set hitCount(value)
    {
      if (value != this._hitCount)
      {
        var oldValue = this._hitCount;
        this._hitCount = value;
        FilterNotifier.triggerListeners("filter.hitCount", this, value, oldValue);
      }
      return this._hitCount;
    },
    get lastHit()
    {
      return this._lastHit;
    },
    set lastHit(value)
    {
      if (value != this._lastHit)
      {
        var oldValue = this._lastHit;
        this._lastHit = value;
        FilterNotifier.triggerListeners("filter.lastHit", this, value, oldValue);
      }
      return this._lastHit;
    },
    domainSource: null,
    domainSeparator: null,
    ignoreTrailingDot: true,
    get domains()
    {
      var domains = null;
      if (this.domainSource)
      {
        var list = this.domainSource.split(this.domainSeparator);
        if (list.length == 1 && list[0][0] != "~")
        {
          domains =
          {
            __proto__: null,
            "": false
          };
          if (this.ignoreTrailingDot)
          {
            list[0] = list[0].replace(/\.+$/, "");
          }
          domains[list[0]] = true;
        }
        else
        {
          var hasIncludes = false;
          for (var i = 0; i < list.length; i++)
          {
            var domain = list[i];
            if (this.ignoreTrailingDot)
            {
              domain = domain.replace(/\.+$/, "");
            }
            if (domain == "")
            {
              continue;
            }
            var include;
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
            {
              domains =
              {
                __proto__: null
              };
            }
            domains[domain] = include;
          }
          domains[""] = !hasIncludes;
        }
        delete this.domainSource;
      }
      this.__defineGetter__("domains", function()
      {
        return domains;
      });
      return this.domains;
    },
    isActiveOnDomain: function(docDomain)
    {
      if (!this.domains)
      {
        return true;
      }
      if (!docDomain)
      {
        return this.domains[""];
      }
      if (this.ignoreTrailingDot)
      {
        docDomain = docDomain.replace(/\.+$/, "");
      }
      docDomain = docDomain.toUpperCase();
      while (true)
      {
        if (docDomain in this.domains)
        {
          return this.domains[docDomain];
        }
        var nextDot = docDomain.indexOf(".");
        if (nextDot < 0)
        {
          break;
        }
        docDomain = docDomain.substr(nextDot + 1);
      }
      return this.domains[""];
    },
    isActiveOnlyOnDomain: function(docDomain)
    {
      if (!docDomain || !this.domains || this.domains[""])
      {
        return false;
      }
      if (this.ignoreTrailingDot)
      {
        docDomain = docDomain.replace(/\.+$/, "");
      }
      docDomain = docDomain.toUpperCase();
      for (var domain in this.domains)
      {
        if (this.domains[domain] && domain != docDomain && (domain.length <= docDomain.length || domain.indexOf("." + docDomain) != domain.length - docDomain.length - 1))
        {
          return false;
        }
      }
      return true;
    },
    serialize: function(buffer)
    {
      if (this._disabled || this._hitCount || this._lastHit)
      {
        Filter.prototype.serialize.call(this, buffer);
        if (this._disabled)
        {
          buffer.push("disabled=true");
        }
        if (this._hitCount)
        {
          buffer.push("hitCount=" + this._hitCount);
        }
        if (this._lastHit)
        {
          buffer.push("lastHit=" + this._lastHit);
        }
      }
    }
  };

  function RegExpFilter(text, regexpSource, contentType, matchCase, domains, thirdParty)
  {
    ActiveFilter.call(this, text, domains);
    if (contentType != null)
    {
      this.contentType = contentType;
    }
    if (matchCase)
    {
      this.matchCase = matchCase;
    }
    if (thirdParty != null)
    {
      this.thirdParty = thirdParty;
    }
    if (regexpSource.length >= 2 && regexpSource[0] == "/" && regexpSource[regexpSource.length - 1] == "/")
    {
      var regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2), this.matchCase ? "" : "i");
      this.__defineGetter__("regexp", function()
      {
        return regexp;
      });
    }
    else
    {
      var regexp = new RegExp(regexpSource.substr(2, regexpSource.length - 3), this.matchCase ? "" : "i");
      this.__defineGetter__("regexp", function()
      {
        return regexp;
      });
    }
  }
  exports.RegExpFilter = RegExpFilter;
  RegExpFilter.prototype =
  {
    __proto__: ActiveFilter.prototype,
    length: 1,
    domainSeparator: "|",
    regexpSource: null,
    get regexp()
    {
      var source = this.regexpSource.replace(/\*+/g, "*");
      if (source[0] == "*")
      {
        source = source.substr(1);
      }
      var pos = source.length - 1;
      if (pos >= 0 && source[pos] == "*")
      {
        source = source.substr(0, pos);
      }
      source = source.replace(/\^\|$/, "^").replace(/\W/g, "\\$&").replace(/\\\*/g, ".*").replace(/\\\^/g, "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x80]|$)").replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^.\\/]+\\.)*?").replace(/^\\\|/, "^").replace(/\\\|$/, "$");
      var regexp = new RegExp(source, this.matchCase ? "" : "i");
      delete this.regexpSource;
      this.__defineGetter__("regexp", function()
      {
        return regexp;
      });
      return this.regexp;
    },
    contentType: 2147483647,
    matchCase: false,
    thirdParty: null,
    matches: function(location, contentType, docDomain, thirdParty)
    {
      var test = this.regexp.test(location);
      var typeMap = RegExpFilter.typeMap[contentType];
      var tp = this.thirdParty;
      var isActive = this.isActiveOnDomain(docDomain);
      if (this.regexp.test(location) && (RegExpFilter.typeMap[contentType] & this.contentType) != 0 && (this.thirdParty == null || this.thirdParty == thirdParty) && this.isActiveOnDomain(docDomain))
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
  RegExpFilter.fromText = function(text)
  {
    var blocking = true;
    var origText = text;
    if (text.indexOf("@@") == 0)
    {
      blocking = false;
      text = text.substr(2);
    }
    var contentType = null;
    var matchCase = null;
    var domains = null;
    var siteKeys = null;
    var thirdParty = null;
    var collapse = null;
    var options;
    var match = text.indexOf("$") >= 0 ? Filter.optionsRegExp.exec(text) : null;
    if (match)
    {
      options = match[1].toUpperCase().split(",");
      text = match.input.substr(0, match.index);
      for (var _loopIndex2 = 0; _loopIndex2 < options.length; ++_loopIndex2)
      {
        var option = options[_loopIndex2];
        var value = null;
        var separatorIndex = option.indexOf("=");
        if (separatorIndex >= 0)
        {
          value = option.substr(separatorIndex + 1);
          option = option.substr(0, separatorIndex);
        }
        option = option.replace(/-/, "_");
        if (option in RegExpFilter.typeMap)
        {
          if (contentType == null)
          {
            contentType = 0;
          }
          contentType |= RegExpFilter.typeMap[option];
        }
        else if (option[0] == "~" && option.substr(1) in RegExpFilter.typeMap)
        {
          if (contentType == null)
          {
            contentType = RegExpFilter.prototype.contentType;
          }
          contentType &= ~RegExpFilter.typeMap[option.substr(1)];
        }
        else if (option == "MATCH_CASE")
        {
          matchCase = true;
        }
        else if (option == "DOMAIN" && typeof value != "undefined")
        {
          domains = value;
        }
        else if (option == "THIRD_PARTY")
        {
          thirdParty = true;
        }
        else if (option == "~THIRD_PARTY")
        {
          thirdParty = false;
        }
        else if (option == "COLLAPSE")
        {
          collapse = true;
        }
        else if (option == "~COLLAPSE")
        {
          collapse = false;
        }
        else if (option == "SITEKEY" && typeof value != "undefined")
        {
          siteKeys = value.split(/\|/);
        }
      }
    }
    if (!blocking && (contentType == null || contentType & RegExpFilter.typeMap.DOCUMENT) && (!options || options.indexOf("DOCUMENT") < 0) && !/^\|?[\w\-]+:/.test(text))
    {
      if (contentType == null)
      {
        contentType = RegExpFilter.prototype.contentType;
      }
      contentType &= ~RegExpFilter.typeMap.DOCUMENT;
    }
    if (!blocking && siteKeys)
    {
      contentType = RegExpFilter.typeMap.DOCUMENT;
    }
    try
    {
      if (blocking)
      {
        return new BlockingFilter(origText, text, contentType, matchCase, domains, thirdParty, collapse);
      }
      else
      {
        return new WhitelistFilter(origText, text, contentType, matchCase, domains, thirdParty, siteKeys);
      }
    }
    catch (e)
    {
      return new InvalidFilter(text, e);
    }
  };
  RegExpFilter.typeMap =
  {
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
    BACKGROUND: 4,
    POPUP: 268435456,
    DONOTTRACK: 536870912,
    ELEMHIDE: 1073741824
  };
  RegExpFilter.prototype.contentType &= ~ (RegExpFilter.typeMap.ELEMHIDE | RegExpFilter.typeMap.DONOTTRACK | RegExpFilter.typeMap.POPUP);

  function BlockingFilter(text, regexpSource, contentType, matchCase, domains, thirdParty, collapse)
  {
    RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains, thirdParty);
    this.collapse = collapse;
  }
  exports.BlockingFilter = BlockingFilter;
  BlockingFilter.prototype =
  {
    __proto__: RegExpFilter.prototype,
    collapse: null
  };

  function WhitelistFilter(text, regexpSource, contentType, matchCase, domains, thirdParty, siteKeys)
  {
    RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains, thirdParty);
    if (siteKeys != null)
    {
      this.siteKeys = siteKeys;
    }
  }
  exports.WhitelistFilter = WhitelistFilter;
  WhitelistFilter.prototype =
  {
    __proto__: RegExpFilter.prototype,
    siteKeys: null
  };

  function ElemHideBase(text, domains, selector)
  {
    ActiveFilter.call(this, text, domains ? domains.toUpperCase() : null);
    if (domains)
    {
      this.selectorDomain = domains.replace(/,~[^,]+/g, "").replace(/^~[^,]+,?/, "").toLowerCase();
    }
    this.selector = selector;
  }
  exports.ElemHideBase = ElemHideBase;
  ElemHideBase.prototype =
  {
    __proto__: ActiveFilter.prototype,
    domainSeparator: ",",
    ignoreTrailingDot: false,
    selectorDomain: null,
    selector: null
  };
  ElemHideBase.fromText = function(text, domain, isException, tagName, attrRules, selector)
  {
    if (!selector)
    {
      if (tagName == "*")
      {
        tagName = "";
      }
      var id = null;
      var additional = "";
      if (attrRules)
      {
        attrRules = attrRules.match(/\([\w\-]+(?:[$^*]?=[^\(\)"]*)?\)/g);
        for (var _loopIndex3 = 0; _loopIndex3 < attrRules.length; ++_loopIndex3)
        {
          var rule = attrRules[_loopIndex3];
          rule = rule.substr(1, rule.length - 2);
          var separatorPos = rule.indexOf("=");
          if (separatorPos > 0)
          {
            rule = rule.replace(/=/, "=\"") + "\"";
            additional += "[" + rule + "]";
          }
          else
          {
            if (id)
            {
              var Utils = require("utils").Utils;
              return new InvalidFilter(text, Utils.getString("filter_elemhide_duplicate_id"));
            }
            else
            {
              id = rule;
            }
          }
        }
      }
      if (id)
      {
        selector = tagName + "." + id + additional + "," + tagName + "#" + id + additional;
      }
      else if (tagName || additional)
      {
        selector = tagName + additional;
      }
      else
      {
        var Utils = require("utils").Utils;
        return new InvalidFilter(text, Utils.getString("filter_elemhide_nocriteria"));
      }
    }
    if (isException)
    {
      return new ElemHideException(text, domain, selector);
    }
    else
    {
      return new ElemHideFilter(text, domain, selector);
    }
  };

  function ElemHideFilter(text, domains, selector)
  {
    ElemHideBase.call(this, text, domains, selector);
  }
  exports.ElemHideFilter = ElemHideFilter;
  ElemHideFilter.prototype =
  {
    __proto__: ElemHideBase.prototype
  };

  function ElemHideException(text, domains, selector)
  {
    ElemHideBase.call(this, text, domains, selector);
  }
  exports.ElemHideException = ElemHideException;
  ElemHideException.prototype =
  {
    __proto__: ElemHideBase.prototype
  };
  return exports;
})();
require.scopes["subscriptionClasses"] = (function()
{
  var exports = {};
  var _tempVar4 = require("filterClasses");
  var ActiveFilter = _tempVar4.ActiveFilter;
  var BlockingFilter = _tempVar4.BlockingFilter;
  var WhitelistFilter = _tempVar4.WhitelistFilter;
  var ElemHideBase = _tempVar4.ElemHideBase;
  var FilterNotifier = require("filterNotifier").FilterNotifier;

  function Subscription(url, title)
  {
    this.url = url;
    this.filters = [];
    if (title)
    {
      this._title = title;
    }
    else
    {
      var Utils = require("utils").Utils;
      this._title = Utils.getString("newGroup_title");
    }
    Subscription.knownSubscriptions[url] = this;
  }
  exports.Subscription = Subscription;
  Subscription.prototype =
  {
    url: null,
    filters: null,
    _title: null,
    _fixedTitle: false,
    _disabled: false,
    get title()
    {
      return this._title;
    },
    set title(value)
    {
      if (value != this._title)
      {
        var oldValue = this._title;
        this._title = value;
        FilterNotifier.triggerListeners("subscription.title", this, value, oldValue);
      }
      return this._title;
    },
    get fixedTitle()
    {
      return this._fixedTitle;
    },
    set fixedTitle(value)
    {
      if (value != this._fixedTitle)
      {
        var oldValue = this._fixedTitle;
        this._fixedTitle = value;
        FilterNotifier.triggerListeners("subscription.fixedTitle", this, value, oldValue);
      }
      return this._fixedTitle;
    },
    get disabled()
    {
      return this._disabled;
    },
    set disabled(value)
    {
      if (value != this._disabled)
      {
        var oldValue = this._disabled;
        this._disabled = value;
        FilterNotifier.triggerListeners("subscription.disabled", this, value, oldValue);
      }
      return this._disabled;
    },
    serialize: function(buffer)
    {
      buffer.push("[Subscription]");
      buffer.push("url=" + this.url);
      buffer.push("title=" + this._title);
      if (this._fixedTitle)
      {
        buffer.push("fixedTitle=true");
      }
      if (this._disabled)
      {
        buffer.push("disabled=true");
      }
    },
    serializeFilters: function(buffer)
    {
      for (var _loopIndex5 = 0; _loopIndex5 < this.filters.length; ++_loopIndex5)
      {
        var filter = this.filters[_loopIndex5];
        buffer.push(filter.text.replace(/\[/g, "\\["));
      }
    },
    toString: function()
    {
      var buffer = [];
      this.serialize(buffer);
      return buffer.join("\n");
    }
  };
  Subscription.knownSubscriptions =
  {
    __proto__: null
  };
  Subscription.fromURL = function(url)
  {
    if (url in Subscription.knownSubscriptions)
    {
      return Subscription.knownSubscriptions[url];
    }
    try
    {
      url = Services.io.newURI(url, null, null).spec;
      return new DownloadableSubscription(url, null);
    }
    catch (e)
    {
      return new SpecialSubscription(url);
    }
  };
  Subscription.fromObject = function(obj)
  {
    var result;
    try
    {
      obj.url = Services.io.newURI(obj.url, null, null).spec;
      result = new DownloadableSubscription(obj.url, obj.title);
      if ("nextURL" in obj)
      {
        result.nextURL = obj.nextURL;
      }
      if ("downloadStatus" in obj)
      {
        result._downloadStatus = obj.downloadStatus;
      }
      if ("lastModified" in obj)
      {
        result.lastModified = obj.lastModified;
      }
      if ("lastSuccess" in obj)
      {
        result.lastSuccess = parseInt(obj.lastSuccess) || 0;
      }
      if ("lastCheck" in obj)
      {
        result._lastCheck = parseInt(obj.lastCheck) || 0;
      }
      if ("expires" in obj)
      {
        result.expires = parseInt(obj.expires) || 0;
      }
      if ("softExpiration" in obj)
      {
        result.softExpiration = parseInt(obj.softExpiration) || 0;
      }
      if ("errors" in obj)
      {
        result._errors = parseInt(obj.errors) || 0;
      }
      if ("requiredVersion" in obj)
      {
        var addonVersion = require("info").addonVersion;
        result.requiredVersion = obj.requiredVersion;
        if (Services.vc.compare(result.requiredVersion, addonVersion) > 0)
        {
          result.upgradeRequired = true;
        }
      }
      if ("alternativeLocations" in obj)
      {
        result.alternativeLocations = obj.alternativeLocations;
      }
      if ("homepage" in obj)
      {
        result._homepage = obj.homepage;
      }
      if ("lastDownload" in obj)
      {
        result._lastDownload = parseInt(obj.lastDownload) || 0;
      }
    }
    catch (e)
    {
      if (!("title" in obj))
      {
        if (obj.url == "~wl~")
        {
          obj.defaults = "whitelist";
        }
        else if (obj.url == "~fl~")
        {
          obj.defaults = "blocking";
        }
        else if (obj.url == "~eh~")
        {
          obj.defaults = "elemhide";
        }
        if ("defaults" in obj)
        {
          var Utils = require("utils").Utils;
          obj.title = Utils.getString(obj.defaults + "Group_title");
        }
      }
      result = new SpecialSubscription(obj.url, obj.title);
      if ("defaults" in obj)
      {
        result.defaults = obj.defaults.split(" ");
      }
    }
    if ("fixedTitle" in obj)
    {
      result._fixedTitle = obj.fixedTitle == "true";
    }
    if ("disabled" in obj)
    {
      result._disabled = obj.disabled == "true";
    }
    return result;
  };

  function SpecialSubscription(url, title)
  {
    Subscription.call(this, url, title);
  }
  exports.SpecialSubscription = SpecialSubscription;
  SpecialSubscription.prototype =
  {
    __proto__: Subscription.prototype,
    defaults: null,
    isDefaultFor: function(filter)
    {
      if (this.defaults && this.defaults.length)
      {
        for (var _loopIndex6 = 0; _loopIndex6 < this.defaults.length; ++_loopIndex6)
        {
          var type = this.defaults[_loopIndex6];
          if (filter instanceof SpecialSubscription.defaultsMap[type])
          {
            return true;
          }
          if (!(filter instanceof ActiveFilter) && type == "blacklist")
          {
            return true;
          }
        }
      }
      return false;
    },
    serialize: function(buffer)
    {
      Subscription.prototype.serialize.call(this, buffer);
      if (this.defaults && this.defaults.length)
      {
        buffer.push("defaults=" + this.defaults.filter(function(type)
        {
          return type in SpecialSubscription.defaultsMap;
        }).join(" "));
      }
      if (this._lastDownload)
      {
        buffer.push("lastDownload=" + this._lastDownload);
      }
    }
  };
  SpecialSubscription.defaultsMap =
  {
    __proto__: null,
    "whitelist": WhitelistFilter,
    "blocking": BlockingFilter,
    "elemhide": ElemHideBase
  };
  SpecialSubscription.create = function(title)
  {
    var url;
    do
    {
      if (title == "frequencyHeuristic")
      {
        url == "frequencyHeuristic";
      }
      else
      {
        url = "~user~" + Math.round(Math.random() * 1000000);
      }
    }
    while (url in Subscription.knownSubscriptions);
    return new SpecialSubscription(url, title);
  };
  SpecialSubscription.createForFilter = function(filter)
  {
    var subscription = SpecialSubscription.create();
    subscription.filters.push(filter);
    for (var type in SpecialSubscription.defaultsMap)
    {
      if (filter instanceof SpecialSubscription.defaultsMap[type])
      {
        subscription.defaults = [type];
      }
    }
    if (!subscription.defaults)
    {
      subscription.defaults = ["blocking"];
    }
    var Utils = require("utils").Utils;
    subscription.title = Utils.getString(subscription.defaults[0] + "Group_title");
    return subscription;
  };

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
    get homepage()
    {
      return this._homepage;
    },
    set homepage(value)
    {
      if (value != this._homepage)
      {
        var oldValue = this._homepage;
        this._homepage = value;
        FilterNotifier.triggerListeners("subscription.homepage", this, value, oldValue);
      }
      return this._homepage;
    },
    get lastDownload()
    {
      return this._lastDownload;
    },
    set lastDownload(value)
    {
      if (value != this._lastDownload)
      {
        var oldValue = this._lastDownload;
        this._lastDownload = value;
        FilterNotifier.triggerListeners("subscription.lastDownload", this, value, oldValue);
      }
      return this._lastDownload;
    },
    serialize: function(buffer)
    {
      Subscription.prototype.serialize.call(this, buffer);
      if (this._homepage)
      {
        buffer.push("homepage=" + this._homepage);
      }
      if (this._lastDownload)
      {
        buffer.push("lastDownload=" + this._lastDownload);
      }
    }
  };

  function ExternalSubscription(url, title)
  {
    RegularSubscription.call(this, url, title);
  }
  exports.ExternalSubscription = ExternalSubscription;
  ExternalSubscription.prototype =
  {
    __proto__: RegularSubscription.prototype,
    serialize: function(buffer)
    {
      throw new Error("Unexpected call, external subscriptions should not be serialized");
    }
  };

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
    nextURL: null,
    get downloadStatus()
    {
      return this._downloadStatus;
    },
    set downloadStatus(value)
    {
      var oldValue = this._downloadStatus;
      this._downloadStatus = value;
      FilterNotifier.triggerListeners("subscription.downloadStatus", this, value, oldValue);
      return this._downloadStatus;
    },
    lastModified: null,
    lastSuccess: 0,
    get lastCheck()
    {
      return this._lastCheck;
    },
    set lastCheck(value)
    {
      if (value != this._lastCheck)
      {
        var oldValue = this._lastCheck;
        this._lastCheck = value;
        FilterNotifier.triggerListeners("subscription.lastCheck", this, value, oldValue);
      }
      return this._lastCheck;
    },
    expires: 0,
    softExpiration: 0,
    get errors()
    {
      return this._errors;
    },
    set errors(value)
    {
      if (value != this._errors)
      {
        var oldValue = this._errors;
        this._errors = value;
        FilterNotifier.triggerListeners("subscription.errors", this, value, oldValue);
      }
      return this._errors;
    },
    requiredVersion: null,
    upgradeRequired: false,
    alternativeLocations: null,
    serialize: function(buffer)
    {
      RegularSubscription.prototype.serialize.call(this, buffer);
      if (this.nextURL)
      {
        buffer.push("nextURL=" + this.nextURL);
      }
      if (this.downloadStatus)
      {
        buffer.push("downloadStatus=" + this.downloadStatus);
      }
      if (this.lastModified)
      {
        buffer.push("lastModified=" + this.lastModified);
      }
      if (this.lastSuccess)
      {
        buffer.push("lastSuccess=" + this.lastSuccess);
      }
      if (this.lastCheck)
      {
        buffer.push("lastCheck=" + this.lastCheck);
      }
      if (this.expires)
      {
        buffer.push("expires=" + this.expires);
      }
      if (this.softExpiration)
      {
        buffer.push("softExpiration=" + this.softExpiration);
      }
      if (this.errors)
      {
        buffer.push("errors=" + this.errors);
      }
      if (this.requiredVersion)
      {
        buffer.push("requiredVersion=" + this.requiredVersion);
      }
      if (this.alternativeLocations)
      {
        buffer.push("alternativeLocations=" + this.alternativeLocations);
      }
    }
  };
  return exports;
})();
require.scopes["filterStorage"] = (function()
{
  var exports = {};
  var IO = require("io").IO;
  var Prefs = require("prefs").Prefs;
  var _tempVar7 = require("filterClasses");
  var Filter = _tempVar7.Filter;
  var ActiveFilter = _tempVar7.ActiveFilter;
  var _tempVar8 = require("subscriptionClasses");
  var Subscription = _tempVar8.Subscription;
  var SpecialSubscription = _tempVar8.SpecialSubscription;
  var ExternalSubscription = _tempVar8.ExternalSubscription;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var formatVersion = 4;
  var FilterStorage = exports.FilterStorage =
  {
    get formatVersion()
    {
      return formatVersion;
    },
    get sourceFile()
    {
      var file = null;
      if (Prefs.patternsfile)
      {
        file = IO.resolveFilePath(Prefs.patternsfile);
      }
      if (!file)
      {
        file = IO.resolveFilePath(Prefs.data_directory);
        if (file)
        {
          file.append("patterns.ini");
        }
      }
      if (!file)
      {
        try
        {
          file = IO.resolveFilePath(Services.prefs.getDefaultBranch("extensions.adblockplus.").getCharPref("data_directory"));
          if (file)
          {
            file.append("patterns.ini");
          }
        }
        catch (e){}
      }
      if (!file)
      {
        Cu.reportError("Adblock Plus: Failed to resolve filter file location from extensions.adblockplus.patternsfile preference");
      }
      this.__defineGetter__("sourceFile", function()
      {
        return file;
      });
      return this.sourceFile;
    },
    fileProperties:
    {
      __proto__: null
    },
    subscriptions: [],
    knownSubscriptions:
    {
      __proto__: null
    },
    getGroupForFilter: function(filter)
    {
      var generalSubscription = null;
      for (var _loopIndex9 = 0; _loopIndex9 < FilterStorage.subscriptions.length; ++_loopIndex9)
      {
        var subscription = FilterStorage.subscriptions[_loopIndex9];
        if (subscription instanceof SpecialSubscription && !subscription.disabled)
        {
          if (subscription.isDefaultFor(filter))
          {
            return subscription;
          }
          if (!generalSubscription && (!subscription.defaults || !subscription.defaults.length))
          {
            generalSubscription = subscription;
          }
        }
      }
      return generalSubscription;
    },
    addSubscription: function(subscription, silent)
    {
      if (subscription.url in FilterStorage.knownSubscriptions)
      {
        return;
      }
      FilterStorage.subscriptions.push(subscription);
      FilterStorage.knownSubscriptions[subscription.url] = subscription;
      console.log("Adding " + subscription.url);
      for (var i = 0; i < FilterStorage.subscriptions.length; i++)
      {
        var subscr = FilterStorage.subscriptions[i];
      }
      addSubscriptionFilters(subscription);
      if (!silent)
      {
        FilterNotifier.triggerListeners("subscription.added", subscription);
      }
    },
    removeSubscription: function(subscription, silent)
    {
      console.log("Removing subscription " + subscription.url);
      for (var i = 0; i < FilterStorage.subscriptions.length; i++)
      {
        if (FilterStorage.subscriptions[i].url == subscription.url)
        {
          removeSubscriptionFilters(subscription);
          FilterStorage.subscriptions.splice(i--, 1);
          delete FilterStorage.knownSubscriptions[subscription.url];
          if (!silent)
          {
            FilterNotifier.triggerListeners("subscription.removed", subscription);
          }
          return;
        }
      }
    },
    moveSubscription: function(subscription, insertBefore)
    {
      var currentPos = FilterStorage.subscriptions.indexOf(subscription);
      if (currentPos < 0)
      {
        return;
      }
      var newPos = insertBefore ? FilterStorage.subscriptions.indexOf(insertBefore) : -1;
      if (newPos < 0)
      {
        newPos = FilterStorage.subscriptions.length;
      }
      if (currentPos < newPos)
      {
        newPos--;
      }
      if (currentPos == newPos)
      {
        return;
      }
      FilterStorage.subscriptions.splice(currentPos, 1);
      FilterStorage.subscriptions.splice(newPos, 0, subscription);
      FilterNotifier.triggerListeners("subscription.moved", subscription);
    },
    updateSubscriptionFilters: function(subscription, filters)
    {
      removeSubscriptionFilters(subscription);
      subscription.oldFilters = subscription.filters;
      subscription.filters = filters;
      addSubscriptionFilters(subscription);
      FilterNotifier.triggerListeners("subscription.updated", subscription);
      delete subscription.oldFilters;
    },
    isFilterInSubscription: function(filter, subscription)
    {
      return subscription.filters.indexOf(filter) > -1;
    },
    addFilter: function(filter, subscription, position, silent)
    {
      if (this.isFilterInSubscription(filter, subscription))
      {
        return;
      }
      if (!subscription)
      {
        if (filter.subscriptions.some(function(s)
        {
          return s instanceof SpecialSubscription && !s.disabled;
        }))
        {
          return;
        }
        subscription = FilterStorage.getGroupForFilter(filter);
      }
      if (!subscription)
      {
        subscription = SpecialSubscription.createForFilter(filter);
        this.addSubscription(subscription);
        return;
      }
      if (typeof position == "undefined")
      {
        position = subscription.filters.length;
      }
      if (filter.subscriptions.indexOf(subscription) < 0)
      {
        filter.subscriptions.push(subscription);
      }
      subscription.filters.splice(position, 0, filter);
      if (!silent)
      {
        FilterNotifier.triggerListeners("filter.added", filter, subscription.url, true);
      }
    },
    removeFilter: function(filter, subscription, position)
    {
      if (subscription != null && !this.isFilterInSubscription(filter, subscription))
      {
        console.log("Attempt to remove filter that wasn't there");
        return;
      }
      var subscriptions = subscription ? [subscription] : filter.subscriptions.slice();
      for (var i = 0; i < subscriptions.length; i++)
      {
        var subscription = subscriptions[i];
        var positions = [];
        if (typeof position == "undefined")
        {
          var index = -1;
          do
          {
            index = subscription.filters.indexOf(filter, index + 1);
            if (index >= 0)
            {
              positions.push(index);
            }
          }
          while (index >= 0);
        }
        else
        {
          positions.push(position);
        }
        for (var j = positions.length - 1; j >= 0; j--)
        {
          var position = positions[j];
          if (subscription.filters[position] == filter)
          {
            subscription.filters.splice(position, 1);
            if (subscription.filters.indexOf(filter) < 0)
            {
              var index = filter.subscriptions.indexOf(subscription);
              if (index >= 0)
              {
                filter.subscriptions.splice(index, 1);
              }
            }
            FilterNotifier.triggerListeners("filter.removed", filter, subscription, position);
          }
        }
      }
    },
    moveFilter: function(filter, subscription, oldPosition, newPosition)
    {
      if (!(subscription instanceof SpecialSubscription) || subscription.filters[oldPosition] != filter)
      {
        return;
      }
      newPosition = Math.min(Math.max(newPosition, 0), subscription.filters.length - 1);
      if (oldPosition == newPosition)
      {
        return;
      }
      subscription.filters.splice(oldPosition, 1);
      subscription.filters.splice(newPosition, 0, filter);
      FilterNotifier.triggerListeners("filter.moved", filter, subscription, oldPosition, newPosition);
    },
    increaseHitCount: function(filter, wnd)
    {
      if (!Prefs.savestats || PrivateBrowsing.enabledForWindow(wnd) || PrivateBrowsing.enabled || !(filter instanceof ActiveFilter))
      {
        return;
      }
      filter.hitCount++;
      filter.lastHit = Date.now();
    },
    resetHitCounts: function(filters)
    {
      if (!filters)
      {
        filters = [];
        for (var text in Filter.knownFilters)
        {
          filters.push(Filter.knownFilters[text]);
        }
      }
      for (var _loopIndex10 = 0; _loopIndex10 < filters.length; ++_loopIndex10)
      {
        var filter = filters[_loopIndex10];
        filter.hitCount = 0;
        filter.lastHit = 0;
      }
    },
    _loading: false,
    loadFromDisk: function(sourceFile)
    {
      if (this._loading)
      {
        return;
      }
      var readFile = function(sourceFile, backupIndex)
      {
        var parser = new INIParser();
        IO.readFromFile(sourceFile, true, parser, function(e)
        {
          if (!e && parser.subscriptions.length == 0)
          {
            e = new Error("No data in the file");
          }
          if (e)
          {
            Cu.reportError(e);
          }
          if (e && !explicitFile)
          {
            sourceFile = this.sourceFile;
            if (sourceFile)
            {
              var _tempVar11 = /^(.*)(\.\w+)$/.exec(sourceFile.leafName) || [null, sourceFile.leafName, ""];
              var part1 = _tempVar11[1];
              var part2 = _tempVar11[2];
              sourceFile = sourceFile.clone();
              sourceFile.leafName = part1 + "-backup" + ++backupIndex + part2;
              IO.statFile(sourceFile, function(e, statData)
              {
                if (!e && statData.exists)
                {
                  readFile(sourceFile, backupIndex);
                }
                else
                {
                  doneReading(parser);
                }
              });
              return;
            }
          }
          doneReading(parser);
        }.bind(this), "FilterStorageRead");
      }.bind(this);
      var doneReading = function(parser)
      {
        var specialMap =
        {
          "~il~": true,
          "~wl~": true,
          "~fl~": true,
          "~eh~": true
        };
        var knownSubscriptions =
        {
          __proto__: null
        };
        for (var i = 0; i < parser.subscriptions.length; i++)
        {
          var subscription = parser.subscriptions[i];
          if (subscription instanceof SpecialSubscription && subscription.filters.length == 0 && subscription.url in specialMap)
          {
            parser.subscriptions.splice(i--, 1);
          }
          else
          {
            knownSubscriptions[subscription.url] = subscription;
          }
        }
        this.fileProperties = parser.fileProperties;
        this.subscriptions = parser.subscriptions;
        this.knownSubscriptions = knownSubscriptions;
        Filter.knownFilters = parser.knownFilters;
        Subscription.knownSubscriptions = parser.knownSubscriptions;
        if (parser.userFilters)
        {
          for (var i = 0; i < parser.userFilters.length; i++)
          {
            var filter = Filter.fromText(parser.userFilters[i]);
            this.addFilter(filter, null, undefined, true);
          }
        }
        this._loading = false;
        FilterNotifier.triggerListeners("load");
        if (sourceFile != this.sourceFile)
        {
          this.saveToDisk();
        }
      }.bind(this);
      var startRead = function(file)
      {
        this._loading = true;
        readFile(file, 0);
      }.bind(this);
      var explicitFile;
      if (sourceFile)
      {
        explicitFile = true;
        startRead(sourceFile);
      }
      else
      {
        explicitFile = false;
        sourceFile = FilterStorage.sourceFile;
        var callback = function(e, statData)
        {
          if (e || !statData.exists)
          {
            var addonRoot = require("info").addonRoot;
            sourceFile = Services.io.newURI(addonRoot + "defaults/patterns.ini", null, null);
          }
          startRead(sourceFile);
        };
        if (sourceFile)
        {
          IO.statFile(sourceFile, callback);
        }
        else
        {
          callback(true);
        }
      }
    },
    _generateFilterData: function(subscriptions)
    {
      var _generatorResult12 = [];
      _generatorResult12.push("# Adblock Plus preferences");
      _generatorResult12.push("version=" + formatVersion);
      var saved =
      {
        __proto__: null
      };
      var buf = [];
      for (var i = 0; i < subscriptions.length; i++)
      {
        var subscription = subscriptions[i];
        for (var j = 0; j < subscription.filters.length; j++)
        {
          var filter = subscription.filters[j];
          if (!(filter.text in saved))
          {
            filter.serialize(buf);
            saved[filter.text] = filter;
            for (var k = 0; k < buf.length; k++)
            {
              _generatorResult12.push(buf[k]);
            }
            buf.splice(0);
          }
        }
      }
      for (var i = 0; i < subscriptions.length; i++)
      {
        var subscription = subscriptions[i];
        _generatorResult12.push("");
        subscription.serialize(buf);
        if (subscription.filters.length)
        {
          buf.push("", "[Subscription filters]");
          subscription.serializeFilters(buf);
        }
        for (var k = 0; k < buf.length; k++)
        {
          _generatorResult12.push(buf[k]);
        }
        buf.splice(0);
      }
      return _generatorResult12;
    },
    _saving: false,
    _needsSave: false,
    saveToDisk: function(targetFile)
    {
      var explicitFile = true;
      if (!targetFile)
      {
        targetFile = FilterStorage.sourceFile;
        explicitFile = false;
      }
      if (!targetFile)
      {
        return;
      }
      if (!explicitFile && this._saving)
      {
        this._needsSave = true;
        return;
      }
      try
      {
        targetFile.parent.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
      }
      catch (e){}
      var writeFilters = function()
      {
        IO.writeToFile(targetFile, true, this._generateFilterData(subscriptions), function(e)
        {
          if (!explicitFile)
          {
            this._saving = false;
          }
          if (e)
          {
            Cu.reportError(e);
          }
          if (!explicitFile && this._needsSave)
          {
            this._needsSave = false;
            this.saveToDisk();
          }
          else
          {
            FilterNotifier.triggerListeners("save");
          }
        }.bind(this), "FilterStorageWrite");
      }.bind(this);
      var checkBackupRequired = function(callbackNotRequired, callbackRequired)
      {
        if (explicitFile || Prefs.patternsbackups <= 0)
        {
          callbackNotRequired();
        }
        else
        {
          IO.statFile(targetFile, function(e, statData)
          {
            if (e || !statData.exists)
            {
              callbackNotRequired();
            }
            else
            {
              var _tempVar13 = /^(.*)(\.\w+)$/.exec(targetFile.leafName) || [null, targetFile.leafName, ""];
              var part1 = _tempVar13[1];
              var part2 = _tempVar13[2];
              var newestBackup = targetFile.clone();
              newestBackup.leafName = part1 + "-backup1" + part2;
              IO.statFile(newestBackup, function(e, statData)
              {
                if (!e && (!statData.exists || (Date.now() - statData.lastModified) / 3600000 >= Prefs.patternsbackupinterval))
                {
                  callbackRequired(part1, part2);
                }
                else
                {
                  callbackNotRequired();
                }
              });
            }
          });
        }
      }.bind(this);
      var removeLastBackup = function(part1, part2)
      {
        var file = targetFile.clone();
        file.leafName = part1 + "-backup" + Prefs.patternsbackups + part2;
        IO.removeFile(file, function(e)
        {
          return renameBackup(part1, part2, Prefs.patternsbackups - 1);
        });
      }.bind(this);
      var renameBackup = function(part1, part2, index)
      {
        if (index > 0)
        {
          var fromFile = targetFile.clone();
          fromFile.leafName = part1 + "-backup" + index + part2;
          var toName = part1 + "-backup" + (index + 1) + part2;
          IO.renameFile(fromFile, toName, function(e)
          {
            return renameBackup(part1, part2, index - 1);
          });
        }
        else
        {
          var toFile = targetFile.clone();
          toFile.leafName = part1 + "-backup" + (index + 1) + part2;
          IO.copyFile(targetFile, toFile, writeFilters);
        }
      }.bind(this);
      var subscriptions = this.subscriptions.filter(function(s)
      {
        return !(s instanceof ExternalSubscription);
      });
      if (!explicitFile)
      {
        this._saving = true;
      }
      checkBackupRequired(writeFilters, removeLastBackup);
    },
    getBackupFiles: function()
    {
      var result = [];
      var _tempVar14 = /^(.*)(\.\w+)$/.exec(FilterStorage.sourceFile.leafName) || [null, FilterStorage.sourceFile.leafName, ""];
      var part1 = _tempVar14[1];
      var part2 = _tempVar14[2];
      for (var i = 1;; i++)
      {
        var file = FilterStorage.sourceFile.clone();
        file.leafName = part1 + "-backup" + i + part2;
        if (file.exists())
        {
          result.push(file);
        }
        else
        {
          break;
        }
      }
      return result;
    }
  };

  function addSubscriptionFilters(subscription)
  {
    if (!(subscription.url in FilterStorage.knownSubscriptions))
    {
      return;
    }
    for (var _loopIndex15 = 0; _loopIndex15 < subscription.filters.length; ++_loopIndex15)
    {
      var filter = subscription.filters[_loopIndex15];
      filter.subscriptions.push(subscription);
    }
  }

  function removeSubscriptionFilters(subscription)
  {
    if (!(subscription.url in FilterStorage.knownSubscriptions))
    {
      return;
    }
    for (var _loopIndex16 = 0; _loopIndex16 < subscription.filters.length; ++_loopIndex16)
    {
      var filter = subscription.filters[_loopIndex16];
      var i = filter.subscriptions.indexOf(subscription);
      if (i >= 0)
      {
        filter.subscriptions.splice(i, 1);
      }
    }
  }
  var PrivateBrowsing = exports.PrivateBrowsing =
  {
    enabled: false,
    enabledForWindow: function(wnd)
    {
      try
      {
        return wnd.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsILoadContext).usePrivateBrowsing;
      }
      catch (e)
      {
        if (e.result != Cr.NS_NOINTERFACE)
        {
          Cu.reportError(e);
        }
        return false;
      }
    },
    init: function()
    {
      if ("@mozilla.org/privatebrowsing;1" in Cc)
      {
        try
        {
          this.enabled = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService).privateBrowsingEnabled;
          Services.obs.addObserver(this, "private-browsing", true);
          onShutdown.add(function()
          {
            Services.obs.removeObserver(this, "private-browsing");
          }.bind(this));
        }
        catch (e)
        {
          Cu.reportError(e);
        }
      }
    },
    observe: function(subject, topic, data)
    {
      if (topic == "private-browsing")
      {
        if (data == "enter")
        {
          this.enabled = true;
        }
        else if (data == "exit")
        {
          this.enabled = false;
        }
      }
    },
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
  };
  PrivateBrowsing.init();

  function INIParser()
  {
    this.fileProperties = this.curObj = {};
    this.subscriptions = [];
    this.knownFilters =
    {
      __proto__: null
    };
    this.knownSubscriptions =
    {
      __proto__: null
    };
  }
  INIParser.prototype =
  {
    subscriptions: null,
    knownFilters: null,
    knownSubscrptions: null,
    wantObj: true,
    fileProperties: null,
    curObj: null,
    curSection: null,
    userFilters: null,
    process: function(val)
    {
      var origKnownFilters = Filter.knownFilters;
      Filter.knownFilters = this.knownFilters;
      var origKnownSubscriptions = Subscription.knownSubscriptions;
      Subscription.knownSubscriptions = this.knownSubscriptions;
      var match;
      try
      {
        if (this.wantObj === true && (match = /^(\w+)=(.*)$/.exec(val)))
        {
          this.curObj[match[1]] = match[2];
        }
        else if (val === null || (match = /^\s*\[(.+)\]\s*$/.exec(val)))
        {
          if (this.curObj)
          {
            switch (this.curSection)
            {
            case "filter":
            case "pattern":
              if ("text" in this.curObj)
              {
                Filter.fromObject(this.curObj);
              }
              break;
            case "subscription":
              var subscription = Subscription.fromObject(this.curObj);
              if (subscription)
              {
                this.subscriptions.push(subscription);
              }
              break;
            case "subscription filters":
            case "subscription patterns":
              if (this.subscriptions.length)
              {
                var subscription = this.subscriptions[this.subscriptions.length - 1];
                for (var _loopIndex17 = 0; _loopIndex17 < this.curObj.length; ++_loopIndex17)
                {
                  var text = this.curObj[_loopIndex17];
                  var filter = Filter.fromText(text);
                  subscription.filters.push(filter);
                  filter.subscriptions.push(subscription);
                }
              }
              break;
            case "user patterns":
              this.userFilters = this.curObj;
              break;
            }
          }
          if (val === null)
          {
            return;
          }
          this.curSection = match[1].toLowerCase();
          switch (this.curSection)
          {
          case "filter":
          case "pattern":
          case "subscription":
            this.wantObj = true;
            this.curObj = {};
            break;
          case "subscription filters":
          case "subscription patterns":
          case "user patterns":
            this.wantObj = false;
            this.curObj = [];
            break;
          default:
            this.wantObj = undefined;
            this.curObj = null;
          }
        }
        else if (this.wantObj === false && val)
        {
          this.curObj.push(val.replace(/\\\[/g, "["));
        }
      }
      finally
      {
        Filter.knownFilters = origKnownFilters;
        Subscription.knownSubscriptions = origKnownSubscriptions;
      }
    }
  };
  return exports;
})();
require.scopes["elemHide"] = (function()
{
  var exports = {};
  var Utils = require("utils").Utils;
  var IO = require("io").IO;
  var Prefs = require("prefs").Prefs;
  var ElemHideException = require("filterClasses").ElemHideException;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var AboutHandler = require("elemHideHitRegistration").AboutHandler;
  var filterByKey =
  {
    __proto__: null
  };
  var keyByFilter =
  {
    __proto__: null
  };
  var knownExceptions =
  {
    __proto__: null
  };
  var exceptions =
  {
    __proto__: null
  };
  var styleURL = null;
  var ElemHide = exports.ElemHide =
  {
    isDirty: false,
    applied: false,
    init: function()
    {
      Prefs.addListener(function(name)
      {
        if (name == "enabled")
        {
          ElemHide.apply();
        }
      });
      onShutdown.add(function()
      {
        ElemHide.unapply();
      });
      var styleFile = IO.resolveFilePath(Prefs.data_directory);
      styleFile.append("elemhide.css");
      styleURL = Services.io.newFileURI(styleFile).QueryInterface(Ci.nsIFileURL);
    },
    clear: function()
    {
      filterByKey =
      {
        __proto__: null
      };
      keyByFilter =
      {
        __proto__: null
      };
      knownExceptions =
      {
        __proto__: null
      };
      exceptions =
      {
        __proto__: null
      };
      ElemHide.isDirty = false;
      ElemHide.unapply();
    },
    add: function(filter)
    {
      if (filter instanceof ElemHideException)
      {
        if (filter.text in knownExceptions)
        {
          return;
        }
        var selector = filter.selector;
        if (!(selector in exceptions))
        {
          exceptions[selector] = [];
        }
        exceptions[selector].push(filter);
        knownExceptions[filter.text] = true;
      }
      else
      {
        if (filter.text in keyByFilter)
        {
          return;
        }
        var key;
        do
        {
          key = Math.random().toFixed(15).substr(5);
        }
        while (key in filterByKey);
        filterByKey[key] = filter;
        keyByFilter[filter.text] = key;
        ElemHide.isDirty = true;
      }
    },
    remove: function(filter)
    {
      if (filter instanceof ElemHideException)
      {
        if (!(filter.text in knownExceptions))
        {
          return;
        }
        var list = exceptions[filter.selector];
        var index = list.indexOf(filter);
        if (index >= 0)
        {
          list.splice(index, 1);
        }
        delete knownExceptions[filter.text];
      }
      else
      {
        if (!(filter.text in keyByFilter))
        {
          return;
        }
        var key = keyByFilter[filter.text];
        delete filterByKey[key];
        delete keyByFilter[filter.text];
        ElemHide.isDirty = true;
      }
    },
    getException: function(filter, docDomain)
    {
      var selector = filter.selector;
      if (!(filter.selector in exceptions))
      {
        return null;
      }
      var list = exceptions[filter.selector];
      for (var i = list.length - 1; i >= 0; i--)
      {
        if (list[i].isActiveOnDomain(docDomain))
        {
          return list[i];
        }
      }
      return null;
    },
    _applying: false,
    _needsApply: false,
    apply: function()
    {
      if (this._applying)
      {
        this._needsApply = true;
        return;
      }
      if (!ElemHide.isDirty || !Prefs.enabled)
      {
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
        }
        else if (!Prefs.enabled && ElemHide.applied)
        {
          ElemHide.unapply();
        }
        return;
      }
      IO.writeToFile(styleURL.file, false, this._generateCSSContent(), function(e)
      {
        this._applying = false;
        if (e && e.result == Cr.NS_ERROR_NOT_AVAILABLE)
        {
          IO.removeFile(styleURL.file, function(e2){});
        }
        else if (e)
        {
          Cu.reportError(e);
        }
        if (this._needsApply)
        {
          this._needsApply = false;
          this.apply();
        }
        else if (!e || e.result == Cr.NS_ERROR_NOT_AVAILABLE)
        {
          ElemHide.isDirty = false;
          ElemHide.unapply();
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
          }
          FilterNotifier.triggerListeners("elemhideupdate");
        }
      }.bind(this), "ElemHideWrite");
      this._applying = true;
    },
    _generateCSSContent: function()
    {
      var _generatorResult12 = [];
      var domains =
      {
        __proto__: null
      };
      var hasFilters = false;
      for (var key in filterByKey)
      {
        var filter = filterByKey[key];
        var domain = filter.selectorDomain || "";
        var list;
        if (domain in domains)
        {
          list = domains[domain];
        }
        else
        {
          list =
          {
            __proto__: null
          };
          domains[domain] = list;
        }
        list[filter.selector] = key;
        hasFilters = true;
      }
      if (!hasFilters)
      {
        throw Cr.NS_ERROR_NOT_AVAILABLE;
      }

      function escapeChar(match)
      {
        return "\\" + match.charCodeAt(0).toString(16) + " ";
      }
      var cssTemplate = "-moz-binding: url(about:" + AboutHandler.aboutPrefix + "?%ID%#dummy) !important;";
      for (var domain in domains)
      {
        var rules = [];
        var list = domains[domain];
        if (domain)
        {
          _generatorResult12.push(("@-moz-document domain(\"" + domain.split(",").join("\"),domain(\"") + "\"){").replace(/[^\x01-\x7F]/g, escapeChar));
        }
        else
        {
          _generatorResult12.push("@-moz-document url-prefix(\"http://\"),url-prefix(\"https://\")," + "url-prefix(\"mailbox://\"),url-prefix(\"imap://\")," + "url-prefix(\"news://\"),url-prefix(\"snews://\"){");
        }
        for (var selector in list)
        {
          _generatorResult12.push(selector.replace(/[^\x01-\x7F]/g, escapeChar) + "{" + cssTemplate.replace("%ID%", list[selector]) + "}");
        }
        _generatorResult12.push("}");
      }
      return _generatorResult12;
    },
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
    get styleURL()
    {
      return ElemHide.applied ? styleURL.spec : null;
    },
    getFilterByKey: function(key)
    {
      return key in filterByKey ? filterByKey[key] : null;
    },
    getSelectorsForDomain: function(domain, specificOnly)
    {
      var result = [];
      for (var key in filterByKey)
      {
        var filter = filterByKey[key];
        if (specificOnly && (!filter.domains || filter.domains[""]))
        {
          continue;
        }
        if (filter.isActiveOnDomain(domain) && !this.getException(filter, domain))
        {
          result.push(filter.selector);
        }
      }
      return result;
    }
  };
  return exports;
})();
require.scopes["matcher"] = (function()
{
  var exports = {};
  var _tempVar18 = require("filterClasses");
  var Filter = _tempVar18.Filter;
  var RegExpFilter = _tempVar18.RegExpFilter;
  var WhitelistFilter = _tempVar18.WhitelistFilter;

  function Matcher()
  {
    this.clear();
  }
  exports.Matcher = Matcher;
  Matcher.prototype =
  {
    filterByKeyword: null,
    keywordByFilter: null,
    clear: function()
    {
      this.filterByKeyword =
      {
        __proto__: null
      };
      this.keywordByFilter =
      {
        __proto__: null
      };
    },
    add: function(filter)
    {
      if (filter.text in this.keywordByFilter)
      {
        return;
      }
      var keyword = this.findKeyword(filter);
      var oldEntry = this.filterByKeyword[keyword];
      if (typeof oldEntry == "undefined")
      {
        this.filterByKeyword[keyword] = filter;
      }
      else if (oldEntry.length == 1)
      {
        this.filterByKeyword[keyword] = [oldEntry, filter];
      }
      else
      {
        oldEntry.push(filter);
      }
      this.keywordByFilter[filter.text] = keyword;
    },
    remove: function(filter)
    {
      if (!(filter.text in this.keywordByFilter))
      {
        return;
      }
      var keyword = this.keywordByFilter[filter.text];
      var list = this.filterByKeyword[keyword];
      if (list.length <= 1)
      {
        delete this.filterByKeyword[keyword];
      }
      else
      {
        var index = list.indexOf(filter);
        if (index >= 0)
        {
          list.splice(index, 1);
          if (list.length == 1)
          {
            this.filterByKeyword[keyword] = list[0];
          }
        }
      }
      delete this.keywordByFilter[filter.text];
    },
    findKeyword: function(filter)
    {
      var result = "";
      var text = filter.text;
      if (Filter.regexpRegExp.test(text))
      {
        return result;
      }
      var match = Filter.optionsRegExp.exec(text);
      if (match)
      {
        text = match.input.substr(0, match.index);
      }
      if (text.substr(0, 2) == "@@")
      {
        text = text.substr(2);
      }
      var candidates = text.toLowerCase().match(/[^a-z0-9%*][a-z0-9%]{3,}(?=[^a-z0-9%*])/g);
      if (!candidates)
      {
        return result;
      }
      var hash = this.filterByKeyword;
      var resultCount = 16777215;
      var resultLength = 0;
      for (var i = 0, l = candidates.length; i < l; i++)
      {
        var candidate = candidates[i].substr(1);
        var count = candidate in hash ? hash[candidate].length : 0;
        if (count < resultCount || count == resultCount && candidate.length > resultLength)
        {
          result = candidate;
          resultCount = count;
          resultLength = candidate.length;
        }
      }
      return result;
    },
    hasFilter: function(filter)
    {
      return filter.text in this.keywordByFilter;
    },
    getKeywordForFilter: function(filter)
    {
      if (filter.text in this.keywordByFilter)
      {
        return this.keywordByFilter[filter.text];
      }
      else
      {
        return null;
      }
    },
    _checkEntryMatch: function(keyword, location, contentType, docDomain, thirdParty)
    {
      var list = this.filterByKeyword[keyword];
      for (var i = 0; i < list.length; i++)
      {
        var filter = list[i];
        if (filter.matches(location, contentType, docDomain, thirdParty))
        {
          return filter;
        }
      }
      return null;
    },
    matchesAny: function(location, contentType, docDomain, thirdParty)
    {
      var candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
      if (candidates === null)
      {
        candidates = [];
      }
      candidates.push("");
      for (var i = 0, l = candidates.length; i < l; i++)
      {
        var substr = candidates[i];
        if (substr in this.filterByKeyword)
        {
          var result = this._checkEntryMatch(substr, location, contentType, docDomain, thirdParty);
          if (result)
          {
            return result;
          }
        }
      }
      return null;
    }
  };

  function CombinedMatcher()
  {
    this.blacklist = new Matcher();
    this.whitelist = new Matcher();
    this.keys =
    {
      __proto__: null
    };
    this.resultCache =
    {
      __proto__: null
    };
  }
  exports.CombinedMatcher = CombinedMatcher;
  CombinedMatcher.maxCacheEntries = 0;
  CombinedMatcher.prototype =
  {
    blacklist: null,
    whitelist: null,
    keys: null,
    resultCache: null,
    cacheEntries: 0,
    clear: function()
    {
      this.blacklist.clear();
      this.whitelist.clear();
      this.keys =
      {
        __proto__: null
      };
      this.resultCache =
      {
        __proto__: null
      };
      this.cacheEntries = 0;
    },
    add: function(filter)
    {
      if (filter instanceof WhitelistFilter)
      {
        if (filter.siteKeys)
        {
          for (var i = 0; i < filter.siteKeys.length; i++)
          {
            this.keys[filter.siteKeys[i]] = filter.text;
          }
        }
        else
        {
          this.whitelist.add(filter);
        }
      }
      else
      {
        this.blacklist.add(filter);
      }
      if (this.cacheEntries > 0)
      {
        this.resultCache =
        {
          __proto__: null
        };
        this.cacheEntries = 0;
      }
    },
    remove: function(filter)
    {
      if (filter instanceof WhitelistFilter)
      {
        if (filter.siteKeys)
        {
          for (var i = 0; i < filter.siteKeys.length; i++)
          {
            delete this.keys[filter.siteKeys[i]];
          }
        }
        else
        {
          this.whitelist.remove(filter);
        }
      }
      else
      {
        this.blacklist.remove(filter);
      }
      if (this.cacheEntries > 0)
      {
        this.resultCache =
        {
          __proto__: null
        };
        this.cacheEntries = 0;
      }
    },
    findKeyword: function(filter)
    {
      if (filter instanceof WhitelistFilter)
      {
        return this.whitelist.findKeyword(filter);
      }
      else
      {
        return this.blacklist.findKeyword(filter);
      }
    },
    hasFilter: function(filter)
    {
      if (filter instanceof WhitelistFilter)
      {
        return this.whitelist.hasFilter(filter);
      }
      else
      {
        return this.blacklist.hasFilter(filter);
      }
    },
    getKeywordForFilter: function(filter)
    {
      if (filter instanceof WhitelistFilter)
      {
        return this.whitelist.getKeywordForFilter(filter);
      }
      else
      {
        return this.blacklist.getKeywordForFilter(filter);
      }
    },
    isSlowFilter: function(filter)
    {
      var matcher = filter instanceof WhitelistFilter ? this.whitelist : this.blacklist;
      if (matcher.hasFilter(filter))
      {
        return !matcher.getKeywordForFilter(filter);
      }
      else
      {
        return !matcher.findKeyword(filter);
      }
    },
    matchesAnyInternal: function(location, contentType, docDomain, thirdParty)
    {
      var candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
      if (candidates === null)
      {
        candidates = [];
      }
      candidates.push("");
      var blacklistHit = null;
      for (var i = 0, l = candidates.length; i < l; i++)
      {
        var substr = candidates[i];
        if (substr in this.whitelist.filterByKeyword)
        {
          var result = this.whitelist._checkEntryMatch(substr, location, contentType, docDomain, thirdParty);
          if (result)
          {
            return result;
          }
        }
        if (substr in this.blacklist.filterByKeyword && blacklistHit === null)
        {
          blacklistHit = this.blacklist._checkEntryMatch(substr, location, contentType, docDomain, thirdParty);
        }
      }
      return blacklistHit;
    },
    matchesAny: function(location, contentType, docDomain, thirdParty)
    {
      var result = this.matchesAnyInternal(location, contentType, docDomain, thirdParty);
      return result;
    },
    matchesByKey: function(location, key, docDomain)
    {
      key = key.toUpperCase();
      if (key in this.keys)
      {
        var filter = Filter.knownFilters[this.keys[key]];
        if (filter && filter.matches(location, "DOCUMENT", docDomain, false))
        {
          return filter;
        }
        else
        {
          return null;
        }
      }
      else
      {
        return null;
      }
    }
  };
  var defaultMatcher = exports.defaultMatcher = new CombinedMatcher();

  function MatcherStore()
  {
    this.clear();
  }
  exports.MatcherStore = MatcherStore;
  MatcherStore.prototype =
  {
    combinedMatcherStore: null,
    clear: function()
    {
      this.combinedMatcherStore =
      {
        __proto__: null
      };
    },
    length: function()
    {
      return Object.keys(this.combinedMatcherStore).length;
    },
    add: function(key)
    {
      if (!(key in this.combinedMatcherStore))
      {
        this.combinedMatcherStore[key] = new CombinedMatcher();
      }
    },
    remove: function(key)
    {
      if (key in this.combinedMatcherStore)
      {
        delete this.combinedMatcherStore[key];
      }
    }
  };
  var matcherStore = exports.matcherStore = new MatcherStore();

  function ActiveMatchers()
  {
    this.blockedOriginsByTab = {};
    this.tabToCurrentHost = {};
    var that = this;
    chrome.tabs.onRemoved.addListener(function(tabId, info)
    {
      that.removeTab(tabId);
    });
  };
  exports.ActiveMatchers = ActiveMatchers;
  var backgroundPage = chrome.extension.getBackgroundPage();
  ActiveMatchers.prototype =
  {
    addTab: function(tabId)
    {
      this.blockedOriginsByTab[tabId] = {};
    },
    setDocumentHost: function(tabId, documentHost)
    {
      this.tabToCurrentHost[tabId] = documentHost;
    },
    getDocumentHost: function(tabId)
    {
      return backgroundPage.getHostForTab(tabId);
      //return this.tabToCurrentHost[tabId];
    },
    getTabData: function(tabId)
    {
      if (!(tabId in this.blockedOriginsByTab))
      {
        return false;
      }
      return this.blockedOriginsByTab[tabId];
    },
    getOriginData: function(tabId, origin)
    {
      var tabData = this.getTabData(tabId);
      if (!tabData)
      {
        return false;
      }
      //TODO tabData is blockedOriginsByTab[tabId]...
      if (!(origin in this.blockedOriginsByTab[tabId]))
      {
        return false;
      }
      return this.blockedOriginsByTab[tabId][origin];
    },
    addOriginToTab: function(tabId, origin)
    {
      if (!this.getTabData(tabId))
      {
        console.log("Warning: could not call addOriginToTab. No tab data");
        return;
      }
      if (!this.getOriginData(tabId, origin))
      {
        this.blockedOriginsByTab[tabId][origin] = {};
      }
    },
    addMatcherToOrigin: function(tabId, origin, matcher, value)
    {
      if (!this.getTabData(tabId))
      {
        this.addTab(tabId);
      }
      if (!this.getOriginData(tabId, origin))
      {
        this.addOriginToTab(tabId, origin);
      }
      this.blockedOriginsByTab[tabId][origin][matcher] = value;
    },
    computeActionForOrigin: function(tabId, origin)
    {
      var documentHost = backgroundPage.getHostForTab(tabId);
      if (!origin || !documentHost || !(isThirdParty(origin, documentHost))){ return false; }
      //TODO: audit this code
      //it checks to see if it's in blockedOriginsByTab and then writes it back there?
      this.computeActiveMatchersFromFilters(tabId, origin);
      var originData = this.getOriginData(tabId, origin);
      if (!originData)
      {
        //console.error("Error computing action data for " + origin);
        if (!this.getTabData(tabId)){
          this.addTab(tabId);
        }
        this.addOriginToTab(tabId, origin);
        return false;
      }
      if (originData["userGreen"])
      {
        this.addMatcherToOrigin(tabId, origin, "latestaction", "usernoaction");
        return true;
      }
      if (originData["userYellow"])
      {
        this.addMatcherToOrigin(tabId, origin, "latestaction", "usercookieblock");
        return true;
      }
      if (originData["userRed"])
      {
        this.addMatcherToOrigin(tabId, origin, "latestaction", "userblock");
        return true;
      }
      if (originData["frequencyHeuristic"])
      {
        if (originData[localStorage.whitelistUrl])
        {
          this.addMatcherToOrigin(tabId, origin, "latestaction", "cookieblock");
        }
        else
        {
          this.addMatcherToOrigin(tabId, origin, "latestaction", "block");
        }
      }
      else
      {
        //return false;
        if(backgroundPage.isOriginInHeuristic(origin) && backgroundPage.originHasTracking(tabId, origin) ){
          this.addMatcherToOrigin(tabId, origin, "latestaction", "noaction");
        } else {
          this.addOriginToTab(tabId, origin);
        }
      }
      return true;
    },
    computeActiveMatchersFromFilters: function(tabId, origin)
    {
      var spyingOrigin = false;
      var perfectMatch = false;
      var unfiredMatchers = [];
      var firedMatchers = [];
      for (var matcherKey in matcherStore.combinedMatcherStore)
      {
        var currentMatcher = matcherStore.combinedMatcherStore[matcherKey];
        // matchesAny will return a filter if the explicit domain or its
        // parent domain has a rule associated with it
        var currentFilter = currentMatcher.matchesAny(origin, "SUBDOCUMENT", this.getDocumentHost(tabId), true);
        // solution: perfectMatch denotes if the explicit subdomain has a rule
        // and clears/prevents the parent domain from overriding its rule
        // Though it must be ignored if we are looking at the base domain.
        // God I hate ABP.
        if(
          currentFilter && 
          (!perfectMatch || getDomainFromFilter(currentFilter.text) == origin)
        ) {
          if (getDomainFromFilter(currentFilter.text) == origin){
            perfectMatch = true;
            for (firedMatch in firedMatchers) {
              unfiredMatchers.push(firedMatch)
            }
            firedMatchers = [];
          }
          this.addMatcherToOrigin(tabId, origin, matcherKey, true);
          spyingOrigin = true;
          firedMatchers.push(matcherKey);
        }
        else
        {
          unfiredMatchers.push(matcherKey);
        }
      }
      if (spyingOrigin)
      {
        for (var i = 0; i < unfiredMatchers.length; i++)
        {
          this.addMatcherToOrigin(tabId, origin, unfiredMatchers[i], false);
        }
      }
    },
    getAllOriginsForTab: function(tabId)
    {
      if (!(tabId in this.blockedOriginsByTab))
      {
        return [];
      }
      return Object.keys(this.blockedOriginsByTab[tabId]);
    },
    getAction: function(tabId, origin)
    {
      //TODO: this looks to be repeating the first call in computeActionForOrigin
      return this.computeActionForOrigin(tabId, origin) && this.blockedOriginsByTab[tabId][origin]["latestaction"];
    },
    removeTab: function(tabId)
    {
      delete this.blockedOriginsByTab[tabId];
    }
  };
  var activeMatchers = exports.activeMatchers = new ActiveMatchers();
  return exports;
})();
require.scopes["filterListener"] = (function()
{
  var exports = {};
  var FilterStorage = require("filterStorage").FilterStorage;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var ElemHide = require("elemHide").ElemHide;
  var defaultMatcher = require("matcher").defaultMatcher;
  var matcherStore = require("matcher").matcherStore;
  var _tempVar19 = require("filterClasses");
  var ActiveFilter = _tempVar19.ActiveFilter;
  var RegExpFilter = _tempVar19.RegExpFilter;
  var ElemHideBase = _tempVar19.ElemHideBase;
  var Prefs = require("prefs").Prefs;
  var batchMode = false;
  var isDirty = 0;
  var FilterListener = exports.FilterListener =
  {
    get batchMode()
    {
      return batchMode;
    },
    set batchMode(value)
    {
      batchMode = value;
      flushElemHide();
    },
    setDirty: function(factor)
    {
      if (factor == 0 && isDirty > 0)
      {
        isDirty = 1;
      }
      else
      {
        isDirty += factor;
      }
      if (isDirty >= 1)
      {
        FilterStorage.saveToDisk();
      }
    }
  };
  var HistoryPurgeObserver =
  {
    observe: function(subject, topic, data)
    {
      if (topic == "browser:purge-session-history" && Prefs.clearStatsOnHistoryPurge)
      {
        FilterStorage.resetHitCounts();
        FilterListener.setDirty(0);
        Prefs.recentReports = [];
      }
    },
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
  };

  function init()
  {
    FilterNotifier.addListener(function(action, item, newValue, oldValue)
    {
      var match = /^(\w+)\.(.*)/.exec(action);
      if (match && match[1] == "filter")
      {
        onFilterChange(match[2], item, newValue, oldValue);
      }
      else if (match && match[1] == "subscription")
      {
        onSubscriptionChange(match[2], item, newValue, oldValue);
      }
      else
      {
        onGenericChange(action, item);
      }
    });
    if ("nsIStyleSheetService" in Ci)
    {
      ElemHide.init();
    }
    else
    {
      flushElemHide = function(){};
    }
    FilterStorage.loadFromDisk();
    Services.obs.addObserver(HistoryPurgeObserver, "browser:purge-session-history", true);
    onShutdown.add(function()
    {
      Services.obs.removeObserver(HistoryPurgeObserver, "browser:purge-session-history");
    });
  }
  init();

  function flushElemHide()
  {
    if (!batchMode && ElemHide.isDirty)
    {
      ElemHide.apply();
    }
  }

  function addFilter(filter, matcher, useSpecialMatcher)
  {
    if (!(filter instanceof ActiveFilter) || filter.disabled)
    {
      return;
    }
    var hasEnabled = false;
    for (var i = 0; i < filter.subscriptions.length; i++)
    {
      if (!filter.subscriptions[i].disabled)
      {
        hasEnabled = true;
      }
    }
    if (!hasEnabled)
    {
      return;
    }
    if (filter instanceof RegExpFilter)
    {
      if (matcher && useSpecialMatcher === true)
      {
        matcher.add(filter);
      }
      defaultMatcher.add(filter);
    }
    else if (filter instanceof ElemHideBase)
    {
      ElemHide.add(filter);
    }
  }

  function removeFilter(filter, matcher)
  {
    if (!(filter instanceof ActiveFilter))
    {
      return;
    }
    if (filter instanceof RegExpFilter)
    {
      if (matcher)
      {
        matcher.remove(filter);
      }
      defaultMatcher.remove(filter);
    }
    else if (filter instanceof ElemHideBase)
    {
      ElemHide.remove(filter);
    }
  }

  function onSubscriptionChange(action, subscription, newValue, oldValue)
  {
    FilterListener.setDirty(1);
    if (action != "added" && action != "removed" && action != "disabled" && action != "updated")
    {
      return;
    }
    if (action != "removed" && !(subscription.url in FilterStorage.knownSubscriptions))
    {
      return;
    }
    if ((action == "added" || action == "removed" || action == "updated") && subscription.disabled)
    {
      return;
    }
    if (action == "added" || action == "removed" || action == "disabled")
    {
      matcherStore.add(subscription.url);
      if (subscription.filters)
      {
        if (action == "added" || action == "disabled" && newValue == false)
        {
          for (var i = 0; i < subscription.filters.length; i++)
          {
            addFilter(subscription.filters[i], matcherStore.combinedMatcherStore[subscription.url], true);
          }
        }
        else
        {
          for (var i = 0; i < subscription.filters.length; i++)
          {
            removeFilter(subscription.filters[i]);
          }
        }
      }
    }
    else if (action == "updated")
    {
      for (var i = 0; i < subscription.oldFilters.length; i++)
      {
        removeFilter(subscription.filters[i]);
      }
      for (var i = 0; i < subscription.filters.length; i++)
      {
        addFilter(subscription.filters[i], matcherStore.combinedMatcherStore[subscription.url], true);
      }
    }
    flushElemHide();
  }

  function onFilterChange(action, filter, newValue, oldValue)
  {
    if (action == "hitCount" || action == "lastHit")
    {
      FilterListener.setDirty(0.002);
    }
    else
    {
      FilterListener.setDirty(1);
    }
    if (action != "added" && action != "removed" && action != "disabled")
    {
      return;
    }
    if ((action == "added" || action == "removed") && filter.disabled)
    {
      return;
    }
    if (action == "added" || action == "disabled" && newValue == false)
    {
      if (newValue)
      {
        addFilter(filter, matcherStore.combinedMatcherStore[newValue], oldValue);
      }
      else
      {
        addFilter(filter);
      }
    }
    else
    {
      removeFilter(filter, matcherStore.combinedMatcherStore[newValue.url]);
    }
    flushElemHide();
  }

  function onGenericChange(action)
  {
    if (action == "load")
    {
      isDirty = 0;
      defaultMatcher.clear();
      ElemHide.clear();
      matcherStore.clear();
      for (var _loopIndex20 = 0; _loopIndex20 < FilterStorage.subscriptions.length; ++_loopIndex20)
      {
        var subscription = FilterStorage.subscriptions[_loopIndex20];
        matcherStore.add(subscription.url);
        if (!subscription.disabled)
        {
          for (var i = 0; i < subscription.filters.length; i++)
          {
            addFilter(subscription.filters[i], matcherStore.combinedMatcherStore[subscription.url], true);
          }
        }
      }
      flushElemHide();
    }
    else if (action == "save")
    {
      isDirty = 0;
    }
  }
  return exports;
})();
require.scopes["synchronizer"] = (function()
{
  var exports = {};
  var Utils = require("utils").Utils;
  var FilterStorage = require("filterStorage").FilterStorage;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var Prefs = require("prefs").Prefs;
  var _tempVar21 = require("filterClasses");
  var Filter = _tempVar21.Filter;
  var CommentFilter = _tempVar21.CommentFilter;
  var _tempVar22 = require("subscriptionClasses");
  var Subscription = _tempVar22.Subscription;
  var DownloadableSubscription = _tempVar22.DownloadableSubscription;
  var MILLISECONDS_IN_SECOND = 1000;
  var SECONDS_IN_MINUTE = 60;
  var SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
  var SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;
  var INITIAL_DELAY = 6 * SECONDS_IN_MINUTE;
  var CHECK_INTERVAL = SECONDS_IN_HOUR;
  var MIN_EXPIRATION_INTERVAL = 1 * SECONDS_IN_DAY;
  var MAX_EXPIRATION_INTERVAL = 14 * SECONDS_IN_DAY;
  var MAX_ABSENSE_INTERVAL = 1 * SECONDS_IN_DAY;
  var timer = null;
  var executing =
  {
    __proto__: null
  };
  var Synchronizer = exports.Synchronizer =
  {
    init: function()
    {
      var callback = function()
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
    },
    isExecuting: function(url)
    {
      return url in executing;
    },
    execute: function(subscription, manual, forceDownload, privacyBadgerSubscription)
    {
      Utils.runAsync(this.executeInternal, this, subscription, manual, forceDownload, privacyBadgerSubscription);
    },
    executeInternal: function(subscription, manual, forceDownload, privacyBadgerSubscription)
    {
      var url = subscription.url;
      if (url in executing)
      {
        return;
      }
      var newURL = subscription.nextURL;
      var hadTemporaryRedirect = false;
      subscription.nextURL = null;
      var loadFrom = newURL;
      var isBaseLocation = true;
      if (!loadFrom)
      {
        loadFrom = url;
      }
      if (loadFrom == url)
      {
        if (subscription.alternativeLocations)
        {
          var options = [
            [1, url]
          ];
          var totalWeight = 1;
          for (var _loopIndex23 = 0; _loopIndex23 < subscription.alternativeLocations.split(",").length; ++_loopIndex23)
          {
            var alternative = subscription.alternativeLocations.split(",")[_loopIndex23];
            if (!/^https?:\/\//.test(alternative))
            {
              continue;
            }
            var weight = 1;
            var match = /;q=([\d\.]+)$/.exec(alternative);
            if (match)
            {
              weight = parseFloat(match[1]);
              if (isNaN(weight) || !isFinite(weight) || weight < 0)
              {
                weight = 1;
              }
              if (weight > 10)
              {
                weight = 10;
              }
              alternative = alternative.substr(0, match.index);
            }
            options.push([weight, alternative]);
            totalWeight += weight;
          }
          var choice = Math.random() * totalWeight;
          for (var _loopIndex24 = 0; _loopIndex24 < options.length; ++_loopIndex24)
          {
            var _tempVar25 = options[_loopIndex24];
            var weight = _tempVar25[0];
            var alternative = _tempVar25[1];
            choice -= weight;
            if (choice < 0)
            {
              loadFrom = alternative;
              break;
            }
          }
          isBaseLocation = loadFrom == url;
        }
      }
      else
      {
        forceDownload = true;
      }
      var addonVersion = require("info").addonVersion;
      loadFrom = loadFrom.replace(/%VERSION%/, "ABP" + addonVersion);
      var request = null;
      var errorCallback = function(error)
      {
        var channelStatus = -1;
        try
        {
          channelStatus = request.channel.status;
        }
        catch (e){}
        var responseStatus = "";
        try
        {
          responseStatus = request.channel.QueryInterface(Ci.nsIHttpChannel).responseStatus;
        }
        catch (e){}
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
      try
      {
        request.overrideMimeType("text/plain");
        request.channel.loadFlags = request.channel.loadFlags | request.channel.INHIBIT_CACHING | request.channel.VALIDATE_ALWAYS;
        if (request.channel instanceof Ci.nsIHttpChannel)
        {
          request.channel.redirectionLimit = 5;
        }
        var oldNotifications = request.channel.notificationCallbacks;
        var oldEventSink = null;
        request.channel.notificationCallbacks =
        {
          QueryInterface: XPCOMUtils.generateQI([Ci.nsIInterfaceRequestor, Ci.nsIChannelEventSink]),
          getInterface: function(iid)
          {
            if (iid.equals(Ci.nsIChannelEventSink))
            {
              try
              {
                oldEventSink = oldNotifications.QueryInterface(iid);
              }
              catch (e){}
              return this;
            }
            if (oldNotifications)
            {
              return oldNotifications.QueryInterface(iid);
            }
            else
            {
              throw Cr.NS_ERROR_NO_INTERFACE;
            }
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
            {
              hadTemporaryRedirect = true;
            }
            else if (!hadTemporaryRedirect)
            {
              newURL = newChannel.URI.spec;
            }
            if (oldEventSink)
            {
              oldEventSink.asyncOnChannelRedirect(oldChannel, newChannel, flags, callback);
            }
            else
            {
              callback.onRedirectVerifyCallback(Cr.NS_OK);
            }
          }
        };
      }
      catch (e)
      {
        Cu.reportError(e);
      }
      if (subscription.lastModified && !forceDownload)
      {
        request.setRequestHeader("If-Modified-Since", subscription.lastModified);
      }
      request.addEventListener("error", function(ev)
      {
        if (onShutdown.done)
        {
          return;
        }
        delete executing[url];
        try
        {
          request.channel.notificationCallbacks = null;
        }
        catch (e){}
        errorCallback("synchronize_connection_error");
      }, false);
      request.addEventListener("load", function(ev)
      {
        if (onShutdown.done)
        {
          return;
        }
        delete executing[url];
        try
        {
          request.channel.notificationCallbacks = null;
        }
        catch (e){}
        if (request.status && request.status != 200 && request.status != 304)
        {
          errorCallback("synchronize_connection_error");
          return;
        }
        var newFilters = null;
        if (request.status != 304)
        {
          newFilters = readFilters(subscription, request.responseText, errorCallback, privacyBadgerSubscription);
          if (!newFilters)
          {
            return;
          }
          subscription.lastModified = request.getResponseHeader("Last-Modified");
        }
        if (isBaseLocation && !hadTemporaryRedirect)
        {
          subscription.alternativeLocations = request.getResponseHeader("X-Alternative-Locations");
        }
        subscription.lastSuccess = subscription.lastDownload = Math.round(Date.now() / MILLISECONDS_IN_SECOND);
        subscription.downloadStatus = "synchronize_ok";
        subscription.errors = 0;
        var now = Math.round(((new Date(request.getResponseHeader("Date"))).getTime() || Date.now()) / MILLISECONDS_IN_SECOND);
        var expires = Math.round((new Date(request.getResponseHeader("Expires"))).getTime() / MILLISECONDS_IN_SECOND) || 0;
        var expirationInterval = expires ? expires - now : 0;
        for (var _loopIndex26 = 0; _loopIndex26 < (newFilters || subscription.filters).length; ++_loopIndex26)
        {
          var filter = (newFilters || subscription.filters)[_loopIndex26];
          if (!(filter instanceof CommentFilter))
          {
            continue;
          }
          var match = /\bExpires\s*(?::|after)\s*(\d+)\s*(h)?/i.exec(filter.text);
          if (match)
          {
            var interval = parseInt(match[1], 10);
            if (match[2])
            {
              interval *= SECONDS_IN_HOUR;
            }
            else
            {
              interval *= SECONDS_IN_DAY;
            }
            if (interval > expirationInterval)
            {
              expirationInterval = interval;
            }
          }
        }
        expirationInterval = Math.min(Math.max(expirationInterval, MIN_EXPIRATION_INTERVAL), MAX_EXPIRATION_INTERVAL);
        subscription.expires = subscription.lastDownload + expirationInterval * 2;
        subscription.softExpiration = subscription.lastDownload + Math.round(expirationInterval * (Math.random() * 0.4 + 0.8));
        if (newFilters)
        {
          var fixedTitle = false;
          for (var i = 0; i < newFilters.length; i++)
          {
            var filter = newFilters[i];
            if (!(filter instanceof CommentFilter))
            {
              continue;
            }
            var match = /^!\s*(\w+)\s*:\s*(.*)/.exec(filter.text);
            if (match)
            {
              var keyword = match[1].toLowerCase();
              var value = match[2];
              var known = true;
              if (keyword == "redirect")
              {
                if (isBaseLocation && value != url)
                {
                  subscription.nextURL = value;
                }
              }
              else if (keyword == "homepage")
              {
                var uri = Utils.makeURI(value);
                if (uri && (uri.scheme == "http" || uri.scheme == "https"))
                {
                  subscription.homepage = uri.spec;
                }
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
              {
                known = false;
              }
              if (known)
              {
                newFilters.splice(i--, 1);
              }
            }
          }
          subscription.fixedTitle = fixedTitle;
        }
        if (isBaseLocation && newURL && newURL != url)
        {
          var listed = subscription.url in FilterStorage.knownSubscriptions;
          if (listed)
          {
            FilterStorage.removeSubscription(subscription);
          }
          url = newURL;
          var newSubscription = Subscription.fromURL(url);
          for (var key in newSubscription)
          {
            delete newSubscription[key];
          }
          for (var key in subscription)
          {
            newSubscription[key] = subscription[key];
          }
          delete Subscription.knownSubscriptions[subscription.url];
          newSubscription.oldSubscription = subscription;
          subscription = newSubscription;
          subscription.url = url;
          if (!(subscription.url in FilterStorage.knownSubscriptions) && listed)
          {
            FilterStorage.addSubscription(subscription);
          }
        }
        if (newFilters)
        {
          FilterStorage.updateSubscriptionFilters(subscription, newFilters);
        }
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

  function checkSubscriptions()
  {
    if (!Prefs.subscriptions_autoupdate)
    {
      return;
    }
    var time = Math.round(Date.now() / MILLISECONDS_IN_SECOND);
    for (var _loopIndex27 = 0; _loopIndex27 < FilterStorage.subscriptions.length; ++_loopIndex27)
    {
      var subscription = FilterStorage.subscriptions[_loopIndex27];
      if (subscription._title != "EFF Auto Whitelist"){
        continue;
      }
      if (!(subscription instanceof DownloadableSubscription))
      {
        continue;
      }
      if (subscription.lastCheck && time - subscription.lastCheck > MAX_ABSENSE_INTERVAL)
      {
        subscription.softExpiration += time - subscription.lastCheck;
      }
      subscription.lastCheck = time;
      if (subscription.expires - time > MAX_EXPIRATION_INTERVAL)
      {
        subscription.expires = time + MAX_EXPIRATION_INTERVAL;
      }
      if (subscription.softExpiration - time > MAX_EXPIRATION_INTERVAL)
      {
        subscription.softExpiration = time + MAX_EXPIRATION_INTERVAL;
      }
      if (subscription.softExpiration > time && subscription.expires > time)
      {
        if(subscription.lastDownload > time){
          //Something has gotten out of sync, lets fix everything
          subscription.lastDownload = time;
          subscription.softExpiration = time + MAX_EXPIRATION_INTERVAL;
          subscription.expires = time + MAX_EXPIRATION_INTERVAL;
          Synchronizer.execute(subscription, false)
        }
        continue;
      }
      if (time - subscription.lastDownload >= MIN_EXPIRATION_INTERVAL || time - subscription.lastDownload < 0)
      {
        Synchronizer.execute(subscription, false);
      }
    }
  }

  function readFilters(subscription, text, errorCallback, privacyBadgerSubscription) {
    var lines = text.split(/[\r\n]+/);
    var result = [];
    for (var _loopIndex28 = 0; _loopIndex28 < lines.length; ++_loopIndex28) {
      var line = lines[_loopIndex28];
      line = Filter.normalize(line);
      if (line) {
        result.push(Filter.fromText(line));
      }
    }
    return result;
  }

  function setError(subscription, error, channelStatus, responseStatus, downloadURL, isBaseLocation, manual)
  {
    if (!isBaseLocation)
    {
      subscription.alternativeLocations = null;
    }
    try
    {
      Cu.reportError("Adblock Plus: Downloading filter subscription " + subscription.title + " failed (" + Utils.getString(error) + ")\n" + "Download address: " + downloadURL + "\n" + "Channel status: " + channelStatus + "\n" + "Server response: " + responseStatus);
    }
    catch (e){}
    subscription.lastDownload = Math.round(Date.now() / MILLISECONDS_IN_SECOND);
    subscription.downloadStatus = error;
    if (!manual)
    {
      if (error == "synchronize_checksum_mismatch")
      {
        subscription.errors = 0;
      }
      else
      {
        subscription.errors++;
      }
      if (subscription.errors >= Prefs.subscriptions_fallbackerrors && /^https?:\/\//i.test(subscription.url))
      {
        subscription.errors = 0;
        var fallbackURL = Prefs.subscriptions_fallbackurl;
        var addonVersion = require("info").addonVersion;
        fallbackURL = fallbackURL.replace(/%VERSION%/g, encodeURIComponent(addonVersion));
        fallbackURL = fallbackURL.replace(/%SUBSCRIPTION%/g, encodeURIComponent(subscription.url));
        fallbackURL = fallbackURL.replace(/%URL%/g, encodeURIComponent(downloadURL));
        fallbackURL = fallbackURL.replace(/%ERROR%/g, encodeURIComponent(error));
        fallbackURL = fallbackURL.replace(/%CHANNELSTATUS%/g, encodeURIComponent(channelStatus));
        fallbackURL = fallbackURL.replace(/%RESPONSESTATUS%/g, encodeURIComponent(responseStatus));
        var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
        request.mozBackgroundRequest = true;
        request.open("GET", fallbackURL);
        request.overrideMimeType("text/plain");
        request.channel.loadFlags = request.channel.loadFlags | request.channel.INHIBIT_CACHING | request.channel.VALIDATE_ALWAYS;
        request.addEventListener("load", function(ev)
        {
          if (onShutdown.done)
          {
            return;
          }
          if (!(subscription.url in FilterStorage.knownSubscriptions))
          {
            return;
          }
          var match = /^(\d+)(?:\s+(\S+))?$/.exec(request.responseText);
          if (match && match[1] == "301" && match[2])
          {
            subscription.nextURL = match[2];
          }
          else if (match && match[1] == "410")
          {
            var data = "[Adblock]\n" + subscription.filters.map(function(f)
            {
              return f.text;
            }).join("\n");
            var url = "data:text/plain," + encodeURIComponent(data);
            var newSubscription = Subscription.fromURL(url);
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
  return exports;
})();
