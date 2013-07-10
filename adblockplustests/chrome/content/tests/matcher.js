(function()
{
  module("Filter matcher", {setup: prepareFilterComponents, teardown: restoreFilterComponents});

  function compareKeywords(text, expected)
  {
    for each (let filter in [Filter.fromText(text), Filter.fromText("@@" + text)])
    {
      let matcher = new Matcher();
      let result = [];
      for each (let dummy in expected)
      {
        keyword = matcher.findKeyword(filter);
        result.push(keyword);
        if (keyword)
        {
          let dummyFilter = Filter.fromText('^' + keyword + '^');
          dummyFilter.filterCount = Infinity;
          matcher.add(dummyFilter);
        }
      }

      equal(result.join(", "), expected.join(", "), "Keyword candidates for " + filter.text);
    }
  }

  function checkMatch(filters, location, contentType, docDomain, thirdParty, expected)
  {
    let matcher = new Matcher();
    for each (let filter in filters)
      matcher.add(Filter.fromText(filter));

    let result = matcher.matchesAny(location, contentType, docDomain, thirdParty);
    if (result)
      result = result.text;

    equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ") with:\n" + filters.join("\n"));

    let combinedMatcher = new CombinedMatcher();
    for (let i = 0; i < 2; i++)
    {
      for each (let filter in filters)
        combinedMatcher.add(Filter.fromText(filter));

      let result = combinedMatcher.matchesAny(location, contentType, docDomain, thirdParty);
      if (result)
        result = result.text;

      equal(result, expected, "combinedMatch(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ") with:\n" + filters.join("\n"));

      // For next run: add whitelisting filters
      filters = filters.map(function(text) "@@" + text);
      if (expected)
        expected = "@@" + expected;
    }
  }

  function cacheCheck(matcher, location, contentType, docDomain, thirdParty, expected)
  {
    let result = matcher.matchesAny(location, contentType, docDomain, thirdParty);
    if (result)
      result = result.text;

    equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ") with static filters");
  }

  test("Matcher class definitions", function()
  {
    equal(typeof Matcher, "function", "typeof Matcher");
    equal(typeof CombinedMatcher, "function", "typeof CombinedMatcher");
    equal(typeof defaultMatcher, "object", "typeof defaultMatcher");
    ok(defaultMatcher instanceof CombinedMatcher, "defaultMatcher is a CombinedMatcher instance");
  });

  test("Keyword extraction", function()
  {
    compareKeywords("*", []);
    compareKeywords("asdf", []);
    compareKeywords("/asdf/", []);
    compareKeywords("/asdf1234", []);
    compareKeywords("/asdf/1234", ["asdf"]);
    compareKeywords("/asdf/1234^", ["asdf", "1234"]);
    compareKeywords("/asdf/123456^", ["123456", "asdf"]);
    compareKeywords("^asdf^1234^56as^", ["asdf", "1234", "56as"]);
    compareKeywords("*asdf/1234^", ["1234"]);
    compareKeywords("|asdf,1234*", ["asdf"]);
    compareKeywords("||domain.example^", ["example", "domain"]);
    compareKeywords("&asdf=1234|", ["asdf", "1234"]);
    compareKeywords("^foo%2Ebar^", ["foo%2ebar"]);
    compareKeywords("^aSdF^1234", ["asdf"]);
    compareKeywords("_asdf_1234_", ["asdf", "1234"]);
    compareKeywords("+asdf-1234=", ["asdf", "1234"]);
    compareKeywords("/123^ad2&ad&", ["123", "ad2"]);
    compareKeywords("/123^ad2&ad$script,domain=example.com", ["123", "ad2"]);
    compareKeywords("^foobar^$donottrack", ["foobar"]);
    compareKeywords("*$donottrack", []);
  });

  test("Filter matching", function()
  {
    checkMatch([], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["abc"], "http://abc/def", "IMAGE", null, false, "abc");
    checkMatch(["abc", "ddd"], "http://abc/def", "IMAGE", null, false, "abc");
    checkMatch(["ddd", "abc"], "http://abc/def", "IMAGE", null, false, "abc");
    checkMatch(["ddd", "abd"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["abc", "://abc/d"], "http://abc/def", "IMAGE", null, false, "://abc/d");
    checkMatch(["://abc/d", "abc"], "http://abc/def", "IMAGE", null, false, "://abc/d");
    checkMatch(["|http://"], "http://abc/def", "IMAGE", null, false, "|http://");
    checkMatch(["|http://abc"], "http://abc/def", "IMAGE", null, false, "|http://abc");
    checkMatch(["|abc"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["|/abc/def"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["/def|"], "http://abc/def", "IMAGE", null, false, "/def|");
    checkMatch(["/abc/def|"], "http://abc/def", "IMAGE", null, false, "/abc/def|");
    checkMatch(["/abc/|"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["http://abc/|"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["|http://abc/def|"], "http://abc/def", "IMAGE", null, false, "|http://abc/def|");
    checkMatch(["|/abc/def|"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["|http://abc/|"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["|/abc/|"], "http://abc/def", "IMAGE", null, false, null);
    checkMatch(["||example.com/abc"], "http://example.com/abc/def", "IMAGE", null, false, "||example.com/abc");
    checkMatch(["||com/abc/def"], "http://example.com/abc/def", "IMAGE", null, false, "||com/abc/def");
    checkMatch(["||com/abc"], "http://example.com/abc/def", "IMAGE", null, false, "||com/abc");
    checkMatch(["||mple.com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null);
    checkMatch(["||.com/abc/def"], "http://example.com/abc/def", "IMAGE", null, false, null);
    checkMatch(["||http://example.com/"], "http://example.com/abc/def", "IMAGE", null, false, null);
    checkMatch(["||example.com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, false, "||example.com/abc/def|");
    checkMatch(["||com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, false, "||com/abc/def|");
    checkMatch(["||example.com/abc|"], "http://example.com/abc/def", "IMAGE", null, false, null);
    checkMatch(["abc", "://abc/d", "asdf1234"], "http://abc/def", "IMAGE", null, false, "://abc/d");
    checkMatch(["foo*://abc/d", "foo*//abc/de", "://abc/de", "asdf1234"], "http://abc/def", "IMAGE", null, false, "://abc/de");
    checkMatch(["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, false, "abc$~third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, true, "abc$third-party");
    checkMatch(["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, false, "//abc/def$~third-party");
    checkMatch(["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, true, "//abc/def$third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def"], "http://abc/def", "IMAGE", null, true, "//abc/def");
    checkMatch(["//abc/def", "abc$third-party", "abc$~third-party"], "http://abc/def", "IMAGE", null, true, "//abc/def");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, true, "//abc/def$third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, false, "abc$~third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def$~third-party"], "http://abc/def", "IMAGE", null, true, "abc$third-party");
    checkMatch(["abc$image", "abc$script", "abc$~image"], "http://abc/def", "IMAGE", null, false, "abc$image");
    checkMatch(["abc$image", "abc$script", "abc$~script"], "http://abc/def", "SCRIPT", null, false, "abc$script");
    checkMatch(["abc$image", "abc$script", "abc$~image"], "http://abc/def", "OTHER", null, false, "abc$~image");
    checkMatch(["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "IMAGE", null, false, "//abc/def$image");
    checkMatch(["//abc/def$image", "//abc/def$script", "//abc/def$~script"], "http://abc/def", "SCRIPT", null, false, "//abc/def$script");
    checkMatch(["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "OTHER", null, false, "//abc/def$~image");
    checkMatch(["abc$image", "abc$~image", "//abc/def"], "http://abc/def", "IMAGE", null, false, "//abc/def");
    checkMatch(["//abc/def", "abc$image", "abc$~image"], "http://abc/def", "IMAGE", null, false, "//abc/def");
    checkMatch(["abc$image", "abc$~image", "//abc/def$image"], "http://abc/def", "IMAGE", null, false, "//abc/def$image");
    checkMatch(["abc$image", "abc$~image", "//abc/def$script"], "http://abc/def", "IMAGE", null, false, "abc$image");
    checkMatch(["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "foo.com", false, "abc$domain=foo.com");
    checkMatch(["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "bar.com", false, "abc$domain=bar.com");
    checkMatch(["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "baz.com", false, "abc$domain=~foo.com|~bar.com");
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "foo.com", false, "abc$domain=foo.com");
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "bar.com", false, null);
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "baz.com", false, null);
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://ccc/def", "IMAGE", "baz.com", false, "ccc$domain=~foo.com|~bar.com");
    checkMatch(["*$image"], "http://ccc/def", "DONOTTRACK", "example.com", false, null);
    checkMatch(["*$donottrack"], "http://ccc/def", "DONOTTRACK", "example.com", false, "*$donottrack");
    checkMatch(["*$donottrack"], "http://ccc/def", "DONOTTRACK", "example.com", false, "*$donottrack");
    checkMatch(["*$donottrack"], "http://ccc/def", "IMAGE", "example.com", false, null);
    checkMatch(["*$donottrack,third-party"], "http://ccc/def", "DONOTTRACK", "example.com", true, "*$donottrack,third-party");
    checkMatch(["*$donottrack,third-party"], "http://ccc/def", "DONOTTRACK", "example.com", false, null);
  });

  test("Result cache checks", function()
  {
    let matcher = new CombinedMatcher();
    matcher.add(Filter.fromText("abc$image"));
    matcher.add(Filter.fromText("abc$script"));
    matcher.add(Filter.fromText("abc$~image,~script,~document"));
    matcher.add(Filter.fromText("cba$third-party"));
    matcher.add(Filter.fromText("cba$~third-party,~script"));
    matcher.add(Filter.fromText("http://def$image"));
    matcher.add(Filter.fromText("http://def$script"));
    matcher.add(Filter.fromText("http://def$~image,~script,~document"));
    matcher.add(Filter.fromText("http://fed$third-party"));
    matcher.add(Filter.fromText("http://fed$~third-party,~script"));

    cacheCheck(matcher, "http://abc", "IMAGE", null, false, "abc$image");
    cacheCheck(matcher, "http://abc", "SCRIPT", null, false, "abc$script");
    cacheCheck(matcher, "http://abc", "OTHER", null, false, "abc$~image,~script,~document");
    cacheCheck(matcher, "http://cba", "IMAGE", null, false, "cba$~third-party,~script");
    cacheCheck(matcher, "http://cba", "IMAGE", null, true, "cba$third-party");
    cacheCheck(matcher, "http://def", "IMAGE", null, false, "http://def$image");
    cacheCheck(matcher, "http://def", "SCRIPT", null, false, "http://def$script");
    cacheCheck(matcher, "http://def", "OTHER", null, false, "http://def$~image,~script,~document");
    cacheCheck(matcher, "http://fed", "IMAGE", null, false, "http://fed$~third-party,~script");
    cacheCheck(matcher, "http://fed", "IMAGE", null, true, "http://fed$third-party");
    cacheCheck(matcher, "http://abc_cba", "DOCUMENT", null, false, "cba$~third-party,~script");
    cacheCheck(matcher, "http://abc_cba", "DOCUMENT", null, true, "cba$third-party");
    cacheCheck(matcher, "http://abc_cba", "SCRIPT", null, false, "abc$script");
    cacheCheck(matcher, "http://def?http://fed", "DOCUMENT", null, false, "http://fed$~third-party,~script");
    cacheCheck(matcher, "http://def?http://fed", "DOCUMENT", null, true, "http://fed$third-party");
    cacheCheck(matcher, "http://def?http://fed", "SCRIPT", null, false, "http://def$script");
  });
})();
