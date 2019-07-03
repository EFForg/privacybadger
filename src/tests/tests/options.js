(function () {

QUnit.module("Options page utils");

let { getOriginsArray } = require("optionslib");

QUnit.test("getOriginsArray", (assert) => {
  const origins = {
    "allowed.com": "allow",
    "blocked.org": "block",
    "alsoblocked.org": "block",
    "cookieblocked.biz": "cookieblock",
    "userAllowed.net": "user_allow",
    "dntDomain.co.uk": "dnt",
  };

  const tests = [
    {
      msg: "Empty, no filters",
      args: [{},],
      expected: []
    },
    {
      msg: "No filters",
      args: [origins,],
      expected: Object.keys(origins)
    },
    {
      msg: "Type filter",
      args: [origins, "", "user"],
      expected: ["userAllowed.net"]
    },
    {
      msg: "Status filter",
      args: [origins, "", "", "allow"],
      expected: ["allowed.com", "userAllowed.net", "dntDomain.co.uk"]
    },
    {
      msg: "Text filter",
      args: [origins, ".org"],
      expected: ["blocked.org", "alsoblocked.org"]
    },
    {
      msg: "Text filter case sensitivity",
      args: [origins, "ALLowed"],
      expected: ["allowed.com", "userAllowed.net"]
    },
    {
      msg: "Text filter with extra space",
      args: [origins, " .org"],
      expected: ["blocked.org", "alsoblocked.org"]
    },
    {
      msg: "Negative text filter",
      args: [origins, "-.org"],
      expected: [
        "allowed.com",
        "cookieblocked.biz",
        "userAllowed.net",
        "dntDomain.co.uk",
      ]
    },
    {
      msg: "Multiple negative text filter",
      args: [origins, "-.net -cookie -.co.uk"],
      expected: ["allowed.com", "blocked.org", "alsoblocked.org"]
    },
    {
      msg: "Multiple text filters",
      args: [origins, "  -also .biz     .org   "],
      expected: ["blocked.org", "cookieblocked.biz"]
    },
    {
      msg: "All filters together",
      args: [origins, ".net", "user", "allow"],
      expected: ["userAllowed.net"]
    },
  ];

  tests.forEach((test) => {
    assert.deepEqual(
      getOriginsArray.apply(window, test.args),
      test.expected,
      test.msg
    );
  });

});

}());
