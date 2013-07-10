(function()
{
  module("Domain restrictions", {setup: prepareFilterComponents, teardown: restoreFilterComponents});

  function testActive(text, domain, expectedActive, expectedOnlyDomain)
  {
    let filter = Filter.fromText(text);
    equal(filter.isActiveOnDomain(domain), expectedActive, text + " active on " + domain);
    equal(filter.isActiveOnlyOnDomain(domain), expectedOnlyDomain, text + " only active on " + domain);
  }

  test("Unrestricted blocking filters", function()
  {
    testActive("foo", null, true, false);
    testActive("foo", "com", true, false);
    testActive("foo", "example.com", true, false);
    testActive("foo", "example.com.", true, false);
    testActive("foo", "foo.example.com", true, false);
    testActive("foo", "mple.com", true, false);
  });

  test("Unrestricted hiding rules", function()
  {
    testActive("#foo", null, true, false);
    testActive("#foo", "com", true, false);
    testActive("#foo", "example.com", true, false);
    testActive("#foo", "example.com.", true, false);
    testActive("#foo", "foo.example.com", true, false);
    testActive("#foo", "mple.com", true, false);
  });

  test("Domain-restricted blocking filters", function()
  {
    testActive("foo$domain=example.com", null, false, false);
    testActive("foo$domain=example.com", "com", false, true);
    testActive("foo$domain=example.com", "example.com", true, true);
    testActive("foo$domain=example.com", "example.com.", true, true);
    testActive("foo$domain=example.com.", "example.com", true, true);
    testActive("foo$domain=example.com.", "example.com.", true, true);
    testActive("foo$domain=example.com", "foo.example.com", true, false);
    testActive("foo$domain=example.com", "mple.com", false, false);
  });

  test("Domain-restricted hiding rules", function()
  {
    testActive("example.com#foo", null, false, false);
    testActive("example.com#foo", "com", false, true);
    testActive("example.com#foo", "example.com", true, true);
    testActive("example.com#foo", "example.com.", false, false);
    testActive("example.com.#foo", "example.com", false, false);
    testActive("example.com.#foo", "example.com.", true, true);
    testActive("example.com#foo", "foo.example.com", true, false);
    testActive("example.com#foo", "mple.com", false, false);
  });

  test("Blocking filters restricted to domain and its subdomain", function()
  {
    testActive("foo$domain=example.com|foo.example.com", null, false, false);
    testActive("foo$domain=example.com|foo.example.com", "com", false, true);
    testActive("foo$domain=example.com|foo.example.com", "example.com", true, true);
    testActive("foo$domain=example.com|foo.example.com", "example.com.", true, true);
    testActive("foo$domain=example.com|foo.example.com", "foo.example.com", true, false);
    testActive("foo$domain=example.com|foo.example.com", "mple.com", false, false);
  });

  test("Hiding rules restricted to domain and its subdomain", function()
  {
    testActive("example.com,foo.example.com#foo", null, false, false);
    testActive("example.com,foo.example.com#foo", "com", false, true);
    testActive("example.com,foo.example.com#foo", "example.com", true, true);
    testActive("example.com,foo.example.com#foo", "example.com.", false, false);
    testActive("example.com,foo.example.com#foo", "foo.example.com", true, false);
    testActive("example.com,foo.example.com#foo", "mple.com", false, false);
  });

  test("Blocking filters with exception for a subdomain", function()
  {
    testActive("foo$domain=~foo.example.com", null, true, false);
    testActive("foo$domain=~foo.example.com", "com", true, false);
    testActive("foo$domain=~foo.example.com", "example.com", true, false);
    testActive("foo$domain=~foo.example.com", "example.com.", true, false);
    testActive("foo$domain=~foo.example.com", "foo.example.com", false, false);
    testActive("foo$domain=~foo.example.com", "mple.com", true, false);
  });

  test("Hiding rules with exception for a subdomain", function()
  {
    testActive("~foo.example.com#foo", null, true, false);
    testActive("~foo.example.com#foo", "com", true, false);
    testActive("~foo.example.com#foo", "example.com", true, false);
    testActive("~foo.example.com#foo", "example.com.", true, false);
    testActive("~foo.example.com#foo", "foo.example.com", false, false);
    testActive("~foo.example.com#foo", "mple.com", true, false);
  });

  test("Blocking filters for domain but not its subdomain", function()
  {
    testActive("foo$domain=example.com|~foo.example.com", null, false, false);
    testActive("foo$domain=example.com|~foo.example.com", "com", false, true);
    testActive("foo$domain=example.com|~foo.example.com", "example.com", true, true);
    testActive("foo$domain=example.com|~foo.example.com", "example.com.", true, true);
    testActive("foo$domain=example.com|~foo.example.com", "foo.example.com", false, false);
    testActive("foo$domain=example.com|~foo.example.com", "mple.com", false, false);
  });

  test("Hiding rules for domain but not its subdomain", function()
  {
    testActive("example.com,~foo.example.com#foo", null, false, false);
    testActive("example.com,~foo.example.com#foo", "com", false, true);
    testActive("example.com,~foo.example.com#foo", "example.com", true, true);
    testActive("example.com,~foo.example.com#foo", "example.com.", false, false);
    testActive("example.com,~foo.example.com#foo", "foo.example.com", false, false);
    testActive("example.com,~foo.example.com#foo", "mple.com", false, false);
  });

  test("Blocking filters for domain but not its TLD", function()
  {
    testActive("foo$domain=example.com|~com", null, false, false);
    testActive("foo$domain=example.com|~com", "com", false, true);
    testActive("foo$domain=example.com|~com", "example.com", true, true);
    testActive("foo$domain=example.com|~com", "example.com.", true, true);
    testActive("foo$domain=example.com|~com", "foo.example.com", true, false);
    testActive("foo$domain=example.com|~com", "mple.com", false, false);
  });

  test("Hiding rules for domain but not its TLD", function()
  {
    testActive("example.com,~com#foo", null, false, false);
    testActive("example.com,~com#foo", "com", false, true);
    testActive("example.com,~com#foo", "example.com", true, true);
    testActive("example.com,~com#foo", "example.com.", false, false);
    testActive("example.com,~com#foo", "foo.example.com", true, false);
    testActive("example.com,~com#foo", "mple.com", false, false);
  });

  test("Blocking filters restricted to an unrelated domain", function()
  {
    testActive("foo$domain=nnnnnnn.nnn", null, false, false);
    testActive("foo$domain=nnnnnnn.nnn", "com", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "example.com", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "example.com.", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "foo.example.com", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "mple.com", false, false);
  });

  test("Hiding rules restricted to an unrelated domain", function()
  {
    testActive("nnnnnnn.nnn#foo", null, false, false);
    testActive("nnnnnnn.nnn#foo", "com", false, false);
    testActive("nnnnnnn.nnn#foo", "example.com", false, false);
    testActive("nnnnnnn.nnn#foo", "example.com.", false, false);
    testActive("nnnnnnn.nnn#foo", "foo.example.com", false, false);
    testActive("nnnnnnn.nnn#foo", "mple.com", false, false);
  });
})();
