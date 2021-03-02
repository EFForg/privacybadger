(function () {

QUnit.module("Options page utils");

let { getOriginsArray } = require("optionslib");

QUnit.test("getOriginsArray", (assert) => {
  const origins = {
    "allowed.com": "allow",
    "blocked.org": "block",
    "alsoblocked.org": "block",
    "cookieblocked.biz": "cookieblock",
    "UserAllowed.net": "user_allow",
    "uuuserblocked.nyc": "user_block",
    "dntDomain.co.uk": "dnt",
    "another.allowed.domain.example": "allow",
  };
  const originsSansAllowed = _.reduce(
    origins, (memo, val, key) => {
      if (val != "allow") {
        memo[key] = val;
      }
      return memo;
    }, {}
  );
  const originsSansDnt = _.reduce(
    origins, (memo, val, key) => {
      if (val != "dnt") {
        memo[key] = val;
      }
      return memo;
    }, {}
  );

  const tests = [
    {
      msg: "Empty, no filters",
      args: [{},],
      expected: []
    },
    {
      msg: "No filters (allowed domains are filtered out)",
      args: [origins,],
      expected: Object.keys(originsSansAllowed)
    },
    {
      msg: "Not-yet-blocked domains are shown",
      args: [origins, null, null, null, true],
      expected: Object.keys(origins)
    },
    {
      msg: "Type filter (user-controlled)",
      args: [origins, "", "user"],
      expected: ["UserAllowed.net", "uuuserblocked.nyc"]
    },
    {
      msg: "Type filter (DNT)",
      args: [origins, "", "dnt"],
      expected: ["dntDomain.co.uk"]
    },
    {
      msg: "Type filter (non-DNT)",
      args: [origins, "", "-dnt", null, true],
      expected: Object.keys(originsSansDnt)
    },
    {
      msg: "Status filter",
      args: [origins, "", "", "allow"],
      expected: ["UserAllowed.net", "dntDomain.co.uk"]
    },
    {
      msg: "Text filter",
      args: [origins, ".org"],
      expected: ["blocked.org", "alsoblocked.org"]
    },
    {
      msg: "Text filter and domain case insensitivity",
      args: [origins, "uSER"],
      expected: ["UserAllowed.net", "uuuserblocked.nyc"]
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
        "cookieblocked.biz",
        "UserAllowed.net",
        "uuuserblocked.nyc",
        "dntDomain.co.uk",
      ]
    },
    {
      msg: "Multiple negative text filter",
      args: [origins, "-.net -cookie -.co.uk"],
      expected: ["blocked.org", "alsoblocked.org", "uuuserblocked.nyc"]
    },
    {
      msg: "Multiple text filters",
      args: [origins, "  -also .biz     .org   "],
      expected: ["blocked.org", "cookieblocked.biz"]
    },
    {
      msg: "All filters together",
      args: [origins, ".net", "user", "allow", true],
      expected: ["UserAllowed.net"]
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
