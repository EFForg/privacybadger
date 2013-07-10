(function()
{
  module("Filter classes", {setup: prepareFilterComponents, teardown: restoreFilterComponents});

  function serializeFilter(filter)
  {
    // Filter serialization only writes out essential properties, need to do a full serialization here
    let result = [];
    result.push("text=" + filter.text);
    if (filter instanceof InvalidFilter)
    {
      result.push("type=invalid");
      if (filter.reason)
        result.push("hasReason");
    }
    else if (filter instanceof CommentFilter)
    {
      result.push("type=comment");
    }
    else if (filter instanceof ActiveFilter)
    {
      result.push("disabled=" + filter.disabled);
      result.push("lastHit=" + filter.lastHit);
      result.push("hitCount=" + filter.hitCount);

      let domains = [];
      if (filter.domains)
      {
        for (let domain in filter.domains)
          if (domain != "")
            domains.push(filter.domains[domain] ? domain : "~" + domain);
      }
      result.push("domains=" + domains.sort().join("|"));

      if (filter instanceof RegExpFilter)
      {
        result.push("regexp=" + filter.regexp.source);
        result.push("contentType=" + filter.contentType);
        result.push("matchCase=" + filter.matchCase);

        result.push("thirdParty=" + filter.thirdParty);
        if (filter instanceof BlockingFilter)
        {
          result.push("type=filterlist");
          result.push("collapse=" + filter.collapse);
        }
        else if (filter instanceof WhitelistFilter)
        {
          result.push("type=whitelist");
        }
      }
      else if (filter instanceof ElemHideBase)
      {
        if (filter instanceof ElemHideFilter)
          result.push("type=elemhide");
        else if (filter instanceof ElemHideException)
          result.push("type=elemhideexception");

        result.push("selectorDomain=" + (filter.selectorDomain || ""));
        result.push("selector=" + filter.selector);
      }
    }
    return result;
  }

  function addDefaults(expected)
  {
    let type = null;
    let hasProperty = {};
    for each (let entry in expected)
    {
      if (/^type=(.*)/.test(entry))
        type = RegExp.$1;
      else if (/^(\w+)/.test(entry))
        hasProperty[RegExp.$1] = true;
    }

    function addProperty(prop, value)
    {
      if (!(prop in hasProperty))
        expected.push(prop + "=" + value);
    }

    if (type == "whitelist" || type == "filterlist" || type == "elemhide" || type == "elemhideexception")
    {
      addProperty("disabled", "false");
      addProperty("lastHit", "0");
      addProperty("hitCount", "0");
    }
    if (type == "whitelist" || type == "filterlist")
    {
      addProperty("contentType", 0x7FFFFFFF & ~(RegExpFilter.typeMap.ELEMHIDE | RegExpFilter.typeMap.DONOTTRACK | RegExpFilter.typeMap.POPUP));
      addProperty("matchCase", "false");
      addProperty("thirdParty", "null");
      addProperty("domains", "");
    }
    if (type == "filterlist")
    {
      addProperty("collapse", "null");
    }
    if (type == "elemhide" || type == "elemhideexception")
    {
      addProperty("selectorDomain", "");
      addProperty("domains", "");
    }
  }

  function compareFilter(text, expected, postInit)
  {
    addDefaults(expected);

    let filter = Filter.fromText(text);
    if (postInit)
      postInit(filter)
    let result = serializeFilter(filter);
    equal(result.sort().join("\n"), expected.sort().join("\n"), text);

    // Test round-trip
    let filter2;
    let buffer = [];
    filter.serialize(buffer);
    if (buffer.length)
    {
      let map = {__proto__: null};
      for each (let line in buffer.slice(1))
      {
        if (/(.*?)=(.*)/.test(line))
          map[RegExp.$1] = RegExp.$2;
      }
      filter2 = Filter.fromObject(map);
    }
    else
    {
      filter2 = Filter.fromText(filter.text);
    }

    equal(serializeFilter(filter).join("\n"), serializeFilter(filter2).join("\n"), text + " deserialization");
  }

  test("Filter class definitions", function()
  {
    equal(typeof Filter, "function", "typeof Filter");
    equal(typeof InvalidFilter, "function", "typeof InvalidFilter");
    equal(typeof CommentFilter, "function", "typeof CommentFilter");
    equal(typeof ActiveFilter, "function", "typeof ActiveFilter");
    equal(typeof RegExpFilter, "function", "typeof RegExpFilter");
    equal(typeof BlockingFilter, "function", "typeof BlockingFilter");
    equal(typeof WhitelistFilter, "function", "typeof WhitelistFilter");
    equal(typeof ElemHideBase, "function", "typeof ElemHideBase");
    equal(typeof ElemHideFilter, "function", "typeof ElemHideFilter");
    equal(typeof ElemHideException, "function", "typeof ElemHideException");
  });

  test("Comments", function()
  {
    compareFilter("!asdf", ["type=comment", "text=!asdf"]);
    compareFilter("!foo#bar", ["type=comment", "text=!foo#bar"]);
    compareFilter("!foo##bar", ["type=comment", "text=!foo##bar"]);
  });

  test("Invalid filters", function()
  {
    compareFilter("/??/", ["type=invalid", "text=/??/", "hasReason"]);

    compareFilter("#dd(asd)(ddd)", ["type=invalid", "text=#dd(asd)(ddd)", "hasReason"]);
    {
      let result = Filter.fromText("#dd(asd)(ddd)").reason;
      equal(result, Utils.getString("filter_elemhide_duplicate_id"), "#dd(asd)(ddd).reason");
    }

    compareFilter("#*", ["type=invalid", "text=#*", "hasReason"]);
    {
      let result = Filter.fromText("#*").reason;
      equal(result, Utils.getString("filter_elemhide_nocriteria"), "#*.reason");
    }
  });

  test("Filters with state", function()
  {
    compareFilter("blabla", ["type=filterlist", "text=blabla", "regexp=blabla"]);
    compareFilter("blabla_default", ["type=filterlist", "text=blabla_default", "regexp=blabla_default"], function(filter)
    {
      filter.disabled = false;
      filter.hitCount = 0;
      filter.lastHit = 0;
    });
    compareFilter("blabla_non_default", ["type=filterlist", "text=blabla_non_default", "regexp=blabla_non_default", "disabled=true", "hitCount=12", "lastHit=20"], function(filter)
    {
      filter.disabled = true;
      filter.hitCount = 12;
      filter.lastHit = 20;
    });
  });

  let t = RegExpFilter.typeMap;
  let defaultTypes = 0x7FFFFFFF & ~(t.ELEMHIDE | t.DONOTTRACK | t.DOCUMENT | t.POPUP);

  test("Special characters", function()
  {
    compareFilter("/ddd|f?a[s]d/", ["type=filterlist", "text=/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d"]);
    compareFilter("*asdf*d**dd*", ["type=filterlist", "text=*asdf*d**dd*", "regexp=asdf.*d.*dd"]);
    compareFilter("|*asd|f*d**dd*|", ["type=filterlist", "text=|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$"]);
    compareFilter("dd[]{}$%<>&()d", ["type=filterlist", "text=dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d"]);

    compareFilter("@@/ddd|f?a[s]d/", ["type=whitelist", "text=@@/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d", "contentType=" + defaultTypes]);
    compareFilter("@@*asdf*d**dd*", ["type=whitelist", "text=@@*asdf*d**dd*", "regexp=asdf.*d.*dd", "contentType=" + defaultTypes]);
    compareFilter("@@|*asd|f*d**dd*|", ["type=whitelist", "text=@@|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$", "contentType=" + defaultTypes]);
    compareFilter("@@dd[]{}$%<>&()d", ["type=whitelist", "text=@@dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d", "contentType=" + defaultTypes]);
  });

  test("Filter options", function()
  {
    compareFilter("bla$match-case,script,other,third-party,domain=foo.com", ["type=filterlist", "text=bla$match-case,script,other,third-party,domain=foo.com", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=FOO.COM"]);
    compareFilter("bla$~match-case,~script,~other,~third-party,domain=~bar.com", ["type=filterlist", "text=bla$~match-case,~script,~other,~third-party,domain=~bar.com", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT), "thirdParty=false", "domains=~BAR.COM"]);
    compareFilter("@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=BAR.COM|FOO.COM|~BAR.FOO.COM|~FOO.BAR.COM"]);

    // background and image should be the same for backwards compatibility
    compareFilter("bla$image", ["type=filterlist", "text=bla$image", "regexp=bla", "contentType=" + (t.IMAGE)]);
    compareFilter("bla$background", ["type=filterlist", "text=bla$background", "regexp=bla", "contentType=" + (t.IMAGE)]);
    compareFilter("bla$~image", ["type=filterlist", "text=bla$~image", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE | t.DOCUMENT)]);
    compareFilter("bla$~background", ["type=filterlist", "text=bla$~background", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE | t.DOCUMENT)]);

    compareFilter("@@bla$~script,~other", ["type=whitelist", "text=@@bla$~script,~other", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
    compareFilter("@@http://bla$~script,~other", ["type=whitelist", "text=@@http://bla$~script,~other", "regexp=http\\:\\/\\/bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
    compareFilter("@@|ftp://bla$~script,~other", ["type=whitelist", "text=@@|ftp://bla$~script,~other", "regexp=^ftp\\:\\/\\/bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
    compareFilter("@@bla$~script,~other,document", ["type=whitelist", "text=@@bla$~script,~other,document", "regexp=bla", "contentType=" +  (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
    compareFilter("@@bla$~script,~other,~document", ["type=whitelist", "text=@@bla$~script,~other,~document", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
    compareFilter("@@bla$document", ["type=whitelist", "text=@@bla$document", "regexp=bla", "contentType=" + t.DOCUMENT]);
    compareFilter("@@bla$~script,~other,elemhide", ["type=whitelist", "text=@@bla$~script,~other,elemhide", "regexp=bla", "contentType=" +  (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.ELEMHIDE)]);
    compareFilter("@@bla$~script,~other,~elemhide", ["type=whitelist", "text=@@bla$~script,~other,~elemhide", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
    compareFilter("@@bla$elemhide", ["type=whitelist", "text=@@bla$elemhide", "regexp=bla", "contentType=" + t.ELEMHIDE]);
    compareFilter("@@bla$~script,~other,donottrack", ["type=whitelist", "text=@@bla$~script,~other,donottrack", "regexp=bla", "contentType=" +  (defaultTypes & ~( t.SCRIPT | t.OTHER) | t.DONOTTRACK)]);
    compareFilter("@@bla$~script,~other,~donottrack", ["type=whitelist", "text=@@bla$~script,~other,~donottrack", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
    compareFilter("@@bla$donottrack", ["type=whitelist", "text=@@bla$donottrack", "regexp=bla", "contentType=" + t.DONOTTRACK]);
  });

  test("Element hiding rules", function()
  {
    compareFilter("#ddd", ["type=elemhide", "text=#ddd", "selector=ddd"]);
    compareFilter("#ddd(fff)", ["type=elemhide", "text=#ddd(fff)", "selector=ddd.fff,ddd#fff"]);
    compareFilter("#ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", ["type=elemhide", "text=#ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", 'selector=ddd[foo="bar"][foo2^="bar2"][foo3*="bar3"][foo4$="bar4"]']);
    compareFilter("#ddd(fff)(foo=bar)", ["type=elemhide", "text=#ddd(fff)(foo=bar)", 'selector=ddd.fff[foo="bar"],ddd#fff[foo="bar"]']);
    compareFilter("#*(fff)", ["type=elemhide", "text=#*(fff)", "selector=.fff,#fff"]);
    compareFilter("#*(foo=bar)", ["type=elemhide", "text=#*(foo=bar)", 'selector=[foo="bar"]']);
    compareFilter("##body > div:first-child", ["type=elemhide", "text=##body > div:first-child", "selector=body > div:first-child"]);
    compareFilter("foo#ddd", ["type=elemhide", "text=foo#ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO"]);
    compareFilter("foo,bar#ddd", ["type=elemhide", "text=foo,bar#ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO"]);
    compareFilter("foo,~bar#ddd", ["type=elemhide", "text=foo,~bar#ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO|~BAR"]);
    compareFilter("foo,~baz,bar#ddd", ["type=elemhide", "text=foo,~baz,bar#ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO|~BAZ"]);
  });

  test("Element hiding exceptions", function()
  {
    compareFilter("#@ddd", ["type=elemhideexception", "text=#@ddd", "selector=ddd"]);
    compareFilter("#@ddd(fff)", ["type=elemhideexception", "text=#@ddd(fff)", "selector=ddd.fff,ddd#fff"]);
    compareFilter("#@ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", ["type=elemhideexception", "text=#@ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", 'selector=ddd[foo="bar"][foo2^="bar2"][foo3*="bar3"][foo4$="bar4"]']);
    compareFilter("#@ddd(fff)(foo=bar)", ["type=elemhideexception", "text=#@ddd(fff)(foo=bar)", 'selector=ddd.fff[foo="bar"],ddd#fff[foo="bar"]']);
    compareFilter("#@*(fff)", ["type=elemhideexception", "text=#@*(fff)", "selector=.fff,#fff"]);
    compareFilter("#@*(foo=bar)", ["type=elemhideexception", "text=#@*(foo=bar)", 'selector=[foo="bar"]']);
    compareFilter("#@#body > div:first-child", ["type=elemhideexception", "text=#@#body > div:first-child", "selector=body > div:first-child"]);
    compareFilter("foo#@ddd", ["type=elemhideexception", "text=foo#@ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO"]);
    compareFilter("foo,bar#@ddd", ["type=elemhideexception", "text=foo,bar#@ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO"]);
    compareFilter("foo,~bar#@ddd", ["type=elemhideexception", "text=foo,~bar#@ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO|~BAR"]);
    compareFilter("foo,~baz,bar#@ddd", ["type=elemhideexception", "text=foo,~baz,bar#@ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO|~BAZ"]);
  });
})();
