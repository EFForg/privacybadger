(function()
{
  module("Matching of blocking filters", {setup: prepareFilterComponents, teardown: restoreFilterComponents});

  function testMatch(text, location, contentType, docDomain, thirdParty, expected)
  {
    function testMatch_internal(text, location, contentType, docDomain, thirdParty, expected)
    {
      let filter = Filter.fromText(text);
      let result = filter.matches(location, contentType, docDomain, thirdParty);
      equal(!!result, expected, '"' + text + '".matches(' + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ")");
    }
    testMatch_internal(text, location, contentType, docDomain, thirdParty, expected);
    if (!/^@@/.test(text))
      testMatch_internal("@@" + text, location, contentType, docDomain, thirdParty, expected);
  }

  test("Basic filters", function()
  {
    testMatch("abc", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc", "http://ABC/adf", "IMAGE", null, false, true);
    testMatch("abc", "http://abd/adf", "IMAGE", null, false, false);
    testMatch("|abc", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("|http://abc", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc|", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc/adf|", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("||example.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, true);
    testMatch("||com/foo", "http://example.com/foo/bar", "IMAGE", null, false, true);
    testMatch("||mple.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, false);
    testMatch("||/example.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, false);
    testMatch("||example.com/foo/bar|", "http://example.com/foo/bar", "IMAGE", null, false, true);
    testMatch("||example.com/foo", "http://foo.com/http://example.com/foo/bar", "IMAGE", null, false, false);
    testMatch("||example.com/foo|", "http://example.com/foo/bar", "IMAGE", null, false, false);
  });

  test("Separator placeholders", function()
  {
    testMatch("abc^d", "http://abc/def", "IMAGE", null, false, true);
    testMatch("abc^e", "http://abc/def", "IMAGE", null, false, false);
    testMatch("def^", "http://abc/def", "IMAGE", null, false, true);
    testMatch("http://abc/d^f", "http://abc/def", "IMAGE", null, false, false);
    testMatch("http://abc/def^", "http://abc/def", "IMAGE", null, false, true);
    testMatch("^foo=bar^", "http://abc/?foo=bar", "IMAGE", null, false, true);
    testMatch("^foo=bar^", "http://abc/?a=b&foo=bar", "IMAGE", null, false, true);
    testMatch("^foo=bar^", "http://abc/?foo=bar&a=b", "IMAGE", null, false, true);
    testMatch("^foo=bar^", "http://abc/?notfoo=bar", "IMAGE", null, false, false);
    testMatch("^foo=bar^", "http://abc/?foo=barnot", "IMAGE", null, false, false);
    testMatch("^foo=bar^", "http://abc/?foo=bar%2Enot", "IMAGE", null, false, false);
    testMatch("||example.com^", "http://example.com/foo/bar", "IMAGE", null, false, true);
    testMatch("||example.com^", "http://example.company.com/foo/bar", "IMAGE", null, false, false);
    testMatch("||example.com^", "http://example.com:1234/foo/bar", "IMAGE", null, false, true);
    testMatch("||example.com^", "http://example.com.com/foo/bar", "IMAGE", null, false, false);
    testMatch("||example.com^", "http://example.com-company.com/foo/bar", "IMAGE", null, false, false);
    testMatch("||example.com^foo", "http://example.com/foo/bar", "IMAGE", null, false, true);
    testMatch("||пример.ру^", "http://пример.ру/foo/bar", "IMAGE", null, false, true);
    testMatch("||пример.ру^", "http://пример.руководитель.ру/foo/bar", "IMAGE", null, false, false);
    testMatch("||пример.ру^", "http://пример.ру:1234/foo/bar", "IMAGE", null, false, true);
    testMatch("||пример.ру^", "http://пример.ру.ру/foo/bar", "IMAGE", null, false, false);
    testMatch("||пример.ру^", "http://пример.ру-ководитель.ру/foo/bar", "IMAGE", null, false, false);
    testMatch("||пример.ру^foo", "http://пример.ру/foo/bar", "IMAGE", null, false, true);
  });

  test("Wildcard matching", function()
  {
    testMatch("abc*d", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc*d", "http://abcd/af", "IMAGE", null, false, true);
    testMatch("abc*d", "http://abc/d/af", "IMAGE", null, false, true);
    testMatch("abc*d", "http://dabc/af", "IMAGE", null, false, false);
    testMatch("*abc", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc*", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("|*abc", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc*|", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc***d", "http://abc/adf", "IMAGE", null, false, true);
  });

  test("Type options", function()
  {
    testMatch("abc$image", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$other", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$other", "http://abc/adf", "OTHER", null, false, true);
    testMatch("abc$~other", "http://abc/adf", "OTHER", null, false, false);
    testMatch("abc$script", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$script", "http://abc/adf", "SCRIPT", null, false, true);
    testMatch("abc$~script", "http://abc/adf", "SCRIPT", null, false, false);
    testMatch("abc$stylesheet", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$stylesheet", "http://abc/adf", "STYLESHEET", null, false, true);
    testMatch("abc$~stylesheet", "http://abc/adf", "STYLESHEET", null, false, false);
    testMatch("abc$object", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$object", "http://abc/adf", "OBJECT", null, false, true);
    testMatch("abc$~object", "http://abc/adf", "OBJECT", null, false, false);
    testMatch("abc$document", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$document", "http://abc/adf", "DOCUMENT", null, false, true);
    testMatch("abc$~document", "http://abc/adf", "DOCUMENT", null, false, false);
    testMatch("abc$subdocument", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$subdocument", "http://abc/adf", "SUBDOCUMENT", null, false, true);
    testMatch("abc$~subdocument", "http://abc/adf", "SUBDOCUMENT", null, false, false);
    testMatch("abc$background", "http://abc/adf", "OBJECT", null, false, false);
    testMatch("abc$background", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$~background", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$xbl", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$xbl", "http://abc/adf", "XBL", null, false, true);
    testMatch("abc$~xbl", "http://abc/adf", "XBL", null, false, false);
    testMatch("abc$ping", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$ping", "http://abc/adf", "PING", null, false, true);
    testMatch("abc$~ping", "http://abc/adf", "PING", null, false, false);
    testMatch("abc$xmlhttprequest", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$xmlhttprequest", "http://abc/adf", "XMLHTTPREQUEST", null, false, true);
    testMatch("abc$~xmlhttprequest", "http://abc/adf", "XMLHTTPREQUEST", null, false, false);
    testMatch("abc$object-subrequest", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$object-subrequest", "http://abc/adf", "OBJECT_SUBREQUEST", null, false, true);
    testMatch("abc$~object-subrequest", "http://abc/adf", "OBJECT_SUBREQUEST", null, false, false);
    testMatch("abc$dtd", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$dtd", "http://abc/adf", "DTD", null, false, true);
    testMatch("abc$~dtd", "http://abc/adf", "DTD", null, false, false);

    testMatch("abc$media", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$media", "http://abc/adf", "MEDIA", null, false, true);
    testMatch("abc$~media", "http://abc/adf", "MEDIA", null, false, false);

    testMatch("abc$font", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$font", "http://abc/adf", "FONT", null, false, true);
    testMatch("abc$~font", "http://abc/adf", "FONT", null, false, false);

    testMatch("abc$image,script", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$~image", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$~script", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$~image,~script", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$~script,~image", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$~document,~script,~other", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$~image,image", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$image,~image", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$~image,image", "http://abc/adf", "SCRIPT", null, false, true);
    testMatch("abc$image,~image", "http://abc/adf", "SCRIPT", null, false, false);
    testMatch("abc$match-case", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$match-case", "http://ABC/adf", "IMAGE", null, false, false);
    testMatch("abc$~match-case", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$~match-case", "http://ABC/adf", "IMAGE", null, false, true);
    testMatch("abc$match-case,image", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$match-case,script", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$match-case,image", "http://ABC/adf", "IMAGE", null, false, false);
    testMatch("abc$match-case,script", "http://ABC/adf", "IMAGE", null, false, false);
    testMatch("abc$third-party", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$third-party", "http://abc/adf", "IMAGE", null, true, true);
    testMatch("abd$third-party", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abd$third-party", "http://abc/adf", "IMAGE", null, true, false);
    testMatch("abc$image,third-party", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$image,third-party", "http://abc/adf", "IMAGE", null, true, true);
    testMatch("abc$~image,third-party", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abc$~image,third-party", "http://abc/adf", "IMAGE", null, true, false);
    testMatch("abc$~third-party", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$~third-party", "http://abc/adf", "IMAGE", null, true, false);
    testMatch("abd$~third-party", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("abd$~third-party", "http://abc/adf", "IMAGE", null, true, false);
    testMatch("abc$image,~third-party", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("abc$image,~third-party", "http://abc/adf", "IMAGE", null, true, false);
    testMatch("abc$~image,~third-party", "http://abc/adf", "IMAGE", null, false, false);
  });

  test("Regular expressions", function()
  {
    testMatch("/abc/", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("/abc/", "http://abcd/adf", "IMAGE", null, false, true);
    testMatch("*/abc/", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("*/abc/", "http://abcd/adf", "IMAGE", null, false, false);
    testMatch("/a\\wc/", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("/a\\wc/", "http://a1c/adf", "IMAGE", null, false, true);
    testMatch("/a\\wc/", "http://a_c/adf", "IMAGE", null, false, true);
    testMatch("/a\\wc/", "http://a%c/adf", "IMAGE", null, false, false);
  });

  test("Regular expressions with type options", function()
  {
    testMatch("/abc/$image", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("/abc/$image", "http://aBc/adf", "IMAGE", null, false, true);
    testMatch("/abc/$script", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("/abc/$~image", "http://abcd/adf", "IMAGE", null, false, false);
    testMatch("/ab{2}c/$image", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("/ab{2}c/$script", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("/ab{2}c/$~image", "http://abcd/adf", "IMAGE", null, false, false);
    testMatch("/abc/$third-party", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("/abc/$third-party", "http://abc/adf", "IMAGE", null, true, true);
    testMatch("/abc/$~third-party", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("/abc/$~third-party", "http://abc/adf", "IMAGE", null, true, false);
    testMatch("/abc/$match-case", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("/abc/$match-case", "http://aBc/adf", "IMAGE", null, true, false);
    testMatch("/ab{2}c/$match-case", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("/ab{2}c/$match-case", "http://aBc/adf", "IMAGE", null, true, false);
    testMatch("/abc/$~match-case", "http://abc/adf", "IMAGE", null, false, true);
    testMatch("/abc/$~match-case", "http://aBc/adf", "IMAGE", null, true, true);
    testMatch("/ab{2}c/$~match-case", "http://abc/adf", "IMAGE", null, false, false);
    testMatch("/ab{2}c/$~match-case", "http://aBc/adf", "IMAGE", null, true, false);
  });

  test("Domain restrictions", function()
  {
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "foo.com.", true, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "Foo.com", true, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, false);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", null, true, false);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "foo.com.", true, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.foo.com", true, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.foo.com.", true, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "Foo.com", true, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.baz.com", true, false);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", null, true, false);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "foo.com.", true, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "Foo.com", true, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, false);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", null, true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "foo.com.", true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "Foo.com", true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, true);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", null, true, true);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com.", true, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.foo.com", true, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.foo.com.", true, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "Foo.com", true, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.baz.com", true, true);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", null, true, true);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "foo.com.", true, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "Foo.com", true, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, true);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", null, true, true);
    testMatch("abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "bar.com", true, false);
    testMatch("abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "baz.com", true, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, true);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "bar.foo.com", true, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.bar.foo.com", true, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "baz.com", true, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "bar.com", true, true);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "bar.net", true, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "foo.net", true, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "com", true, true);
    testMatch("abc$domain=foo.com", "http://ccc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$domain=foo.com", "http://ccc/def", "IMAGE", "bar.com", true, false);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "IMAGE", "bar.com", true, false);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "OBJECT", "foo.com", true, false);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "OBJECT", "bar.com", true, false);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "IMAGE", "bar.com", true, false);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "OBJECT", "foo.com", true, true);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "OBJECT", "bar.com", true, false);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "IMAGE", "foo.com", true, true);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "IMAGE", "bar.com", true, false);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "OBJECT", "foo.com", true, false);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "OBJECT", "bar.com", true, false);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "IMAGE", "foo.com", true, false);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "IMAGE", "bar.com", true, false);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "OBJECT", "foo.com", true, true);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "OBJECT", "bar.com", true, false);
  });

  test("Exception rules", function()
  {
    testMatch("@@test", "http://test/", "DOCUMENT", null, false, false);
    testMatch("@@http://test*", "http://test/", "DOCUMENT", null, false, true);
    testMatch("@@ftp://test*", "ftp://test/", "DOCUMENT", null, false, true);
    testMatch("@@test$document", "http://test/", "DOCUMENT", null, false, true);
    testMatch("@@test$document,image", "http://test/", "DOCUMENT", null, false, true);
    testMatch("@@test$~image", "http://test/", "DOCUMENT", null, false, false);
    testMatch("@@test$~image,document", "http://test/", "DOCUMENT", null, false, true);
    testMatch("@@test$document,~image", "http://test/", "DOCUMENT", null, false, true);
    testMatch("@@test$document,domain=foo.com", "http://test/", "DOCUMENT", "foo.com", false, true);
    testMatch("@@test$document,domain=foo.com", "http://test/", "DOCUMENT", "bar.com", false, false);
    testMatch("@@test$document,domain=~foo.com", "http://test/", "DOCUMENT", "foo.com", false, false);
    testMatch("@@test$document,domain=~foo.com", "http://test/", "DOCUMENT", "bar.com", false, true);
  });
})();
