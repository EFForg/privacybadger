import { filterDomains } from "../../lib/options.js";

QUnit.module("Options page utils");

QUnit.test("filterDomains()", (assert) => {
  const domains = {
    "allowed.com": "allow",
    "blocked.org": "block",
    "alsoblocked.org": "block",
    "cookieblocked.biz": "cookieblock",
    "UserAllowed.net": "user_allow",
    "uuuserblocked.nyc": "user_block",
    "dntDomain.co.uk": "dnt",
    "another.allowed.domain.example": "allow",
  };
  const domainsSansAllowed = Object.fromEntries(
    Object.entries(domains).filter(
      ([, val]) => val != "allow"
    )
  );
  const domainsSansAllowedSansDnt = Object.fromEntries(
    Object.entries(domainsSansAllowed).filter(
      ([, val]) => val != "dnt"
    )
  );
  const seedBases = new Set([
    "allowed.com",
    "blocked.org",
    "alsoblocked.org",
    "cookieblocked.biz",
  ]);

  const tests = [
    {
      msg: "Empty, no filters",
      args: [{},],
      expected: []
    },
    {
      msg: "No filters (allowed domains are filtered out)",
      args: [domains,],
      expected: Object.keys(domainsSansAllowed)
    },
    {
      msg: "Not-yet-blocked domains are shown",
      args: [domains, { showNotYetBlocked: true }],
      expected: Object.keys(domains)
    },
    {
      msg: "Type filter (user-controlled)",
      args: [domains, { typeFilter: 'user' }],
      expected: ["UserAllowed.net", "uuuserblocked.nyc"]
    },
    {
      msg: "Type filter (DNT)",
      args: [domains, { typeFilter: 'dnt' }],
      expected: ["dntDomain.co.uk"]
    },
    {
      msg: "Type filter (non-DNT)",
      args: [domains, { typeFilter: '-dnt' }],
      expected: Object.keys(domainsSansAllowedSansDnt)
    },
    {
      msg: "Status filter",
      args: [domains, { statusFilter: 'allow' }],
      expected: ["UserAllowed.net", "dntDomain.co.uk"]
    },
    {
      msg: "Text filter",
      args: [domains, { searchFilter: ".org" }],
      expected: ["blocked.org", "alsoblocked.org"]
    },
    {
      msg: "Text filter and domain case insensitivity",
      args: [domains, { searchFilter: "uSER" }],
      expected: ["UserAllowed.net", "uuuserblocked.nyc"]
    },
    {
      msg: "Text filter with extra space",
      args: [domains, { searchFilter: " .org" }],
      expected: ["blocked.org", "alsoblocked.org"]
    },
    {
      msg: "Negative text filter",
      args: [domains, { searchFilter: "-.org" }],
      expected: [
        "cookieblocked.biz",
        "UserAllowed.net",
        "uuuserblocked.nyc",
        "dntDomain.co.uk",
      ]
    },
    {
      msg: "Multiple negative text filter",
      args: [domains, { searchFilter: "-.net -cookie -.co.uk" }],
      expected: ["blocked.org", "alsoblocked.org", "uuuserblocked.nyc"]
    },
    {
      msg: "Multiple text filters",
      args: [domains, { searchFilter: "  -also .biz     .org   "}],
      expected: ["blocked.org", "cookieblocked.biz"]
    },
    {
      msg: "All filters together",
      args: [domains, {
        searchFilter: ".net",
        typeFilter: 'user',
        statusFilter: 'allow',
        showNotYetBlocked: true,
      }],
      expected: ["UserAllowed.net"]
    },
    {
      msg: "Hiding pre-trained domains",
      args: [domains, {
        showNotYetBlocked: true,
        hideInSeed: true,
        seedBases,
        seedNotYetBlocked: new Set()
      }],
      expected: [
        "UserAllowed.net",
        "uuuserblocked.nyc",
        "dntDomain.co.uk",
        "another.allowed.domain.example",
      ]
    },
    {
      msg: "Hiding pre-trained domains requires seed data",
      args: [domains, {
        showNotYetBlocked: true,
        hideInSeed: true,
      }],
      expected: Object.keys(domains)
    },
    {
      msg: "Hiding pre-trained domains should keep domains that went from allowed to blocked",
      args: [domains, {
        showNotYetBlocked: true,
        hideInSeed: true,
        seedBases,
        seedNotYetBlocked: new Set(["alsoblocked.org"])
      }],
      expected: [
        "alsoblocked.org",
        "UserAllowed.net",
        "uuuserblocked.nyc",
        "dntDomain.co.uk",
        "another.allowed.domain.example",
      ]
    },
  ];

  tests.forEach((test) => {
    assert.deepEqual(
      filterDomains.apply(globalThis, test.args),
      test.expected,
      test.msg
    );
  });

});
