(function () {

QUnit.module("HTML Utils");

var htmlUtils = require("htmlutils").htmlUtils;

QUnit.test("isChecked", function (assert) {
  // Test parameters
  var tests = [
    {
      inputAction: "allow",
      originAction: "allow",
      expectedResult: "checked",
    },
    {
      inputAction: "allow",
      originAction: "block",
      expectedResult: "",
    },
  ];

  // Run each test.
  for (var i = 0; i < tests.length; i++) {
    var inputAction = tests[i].inputAction;
    var originAction = tests[i].originAction;
    var expected = tests[i].expectedResult;
    var message = "Inputs: '" + inputAction + "' and '" + originAction + "'";
    assert.equal(htmlUtils.isChecked(inputAction, originAction), expected, message);
  }
});

QUnit.test("getActionDescription", (assert) => {
  // Test parameters
  const getMessage = chrome.i18n.getMessage,
    origin = "pbtest.org";
  const tests = [
    {
      action: "block",
      origin,
      expectedResult: getMessage('badger_status_block', origin)
    },
    {
      action: "cookieblock",
      origin,
      expectedResult: getMessage('badger_status_cookieblock', origin)
    },
    {
      action: "allow",
      origin,
      expectedResult: getMessage('badger_status_allow', origin)
    },
  ];

  // Run each test.
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i],
      message = `Inputs: '${test.action}' and '${test.origin}'`;

    assert.equal(
      htmlUtils.getActionDescription(test.action, test.origin),
      test.expectedResult,
      message
    );
  }
});

QUnit.test("getToggleHtml", function (assert) {
  // Test parameters
  var tests = [
    {
      origin: "pbtest.org",
      action: "block",
      expectedResult: "0",
    },
    {
      origin: "pbtest.org",
      action: "cookieblock",
      expectedResult: "1",
    },
    {
      origin: "pbtest.org",
      action: "allow",
      expectedResult: "2",
    },
  ];

  // Run each test.
  for (var i = 0; i < tests.length; i++) {
    var origin = tests[i].origin;
    var action = tests[i].action;
    var expected = tests[i].expectedResult;
    var message = "Inputs: '" + origin + "' and '" + action + "'";
    var html = htmlUtils.getToggleHtml(origin, action);
    var inputValue = $('input[name="' + origin + '"]:checked', html).val();
    assert.equal(inputValue, expected, message);
  }
});

QUnit.test("getOriginHtml", function (assert) {
  // Test parameters
  var tests = [
    {
      existingHtml: '<div id="existinghtml"></div>',
      origin: "pbtest.org",
      action: "allow",
      isWhitelisted: false,
    },
    {
      existingHtml: '<div id="existinghtml"></div>',
      origin: "pbtest.org",
      action: "block",
      isWhitelisted: true,
    },
  ];

  // Run each test.
  for (var i = 0; i < tests.length; i++) {
    var existingHtml = tests[i].existingHtml;
    var origin = tests[i].origin;
    var action = tests[i].action;
    var isWhitelisted = tests[i].isWhitelisted;

    var htmlResult = existingHtml + htmlUtils.getOriginHtml(
      origin, action, isWhitelisted);

    // Make sure existing HTML is present.
    var existingHtmlExists = htmlResult.indexOf(existingHtml) > -1;
    assert.ok(existingHtmlExists, "Existing HTML should be present");

    // Make sure origin is set.
    var originDataExists = htmlResult.indexOf('data-origin="' + origin + '"') > -1;
    assert.ok(originDataExists, "Origin should be set");

    // Check for presence of DNT content.
    var dntExists = htmlResult.indexOf('id="dnt-compliant"') > -1;
    assert.equal(dntExists, isWhitelisted,
      "DNT div should " + ((dntExists) ? "" : "not ") + "be present");
  }
});

QUnit.test("makeSortable", (assert) => {
  const tests = [
    ["bbc.co.uk", "bbc."],
    ["s3.amazonaws.com", "s3."],
    ["01234.global.ssl.fastly.net", "01234."],
    ["api.nextgen.guardianapps.co.uk", "guardianapps.nextgen.api"],
    ["localhost", "localhost."],
    ["127.0.0.1", "127.0.0.1."],
  ];
  tests.forEach((test) => {
    assert.equal(
      htmlUtils.makeSortable(test[0]),
      test[1],
      test[0]
    );
  });
});

QUnit.test("sortDomains", (assert) => {
  const DOMAINS = [
    "ajax.cloudflare.com",
    "betrad.com",
    "c.betrad.com",
    "cloudflare.com",
    "condenastdigital.com",
    "weather.com"
  ];
  const tests = [
    {
      msg: "disquscdn.com was getting sorted with the Cs",
      domains: [
        "a.disquscdn.com",
        "caradvice.disqus.com",
        "carscoop.disqus.com",
        "c.disquscdn.com",
        "celebstoner.disqus.com",
        "changemon.disqus.com",
        "disqusads.com",
        "disquscdn.com",
        "disqus.com",
        "uploads.disquscdn.com",
        "wired.disqus.com",
      ],
      expected: [
        "disqus.com",
        "caradvice.disqus.com",
        "carscoop.disqus.com",
        "celebstoner.disqus.com",
        "changemon.disqus.com",
        "wired.disqus.com",
        "disqusads.com",
        "disquscdn.com",
        "a.disquscdn.com",
        "c.disquscdn.com",
        "uploads.disquscdn.com",
      ]
    },
    {
      msg: "bbc.co.uk was getting sorted with the Cs",
      domains: DOMAINS.concat([
        "baidu.com",
        "bbc.co.uk",
        "static.bbc.co.uk",
      ]),
      expected: [
        "baidu.com",
        "bbc.co.uk",
        "static.bbc.co.uk",
        "betrad.com",
        "c.betrad.com",
        "cloudflare.com",
        "ajax.cloudflare.com",
        "condenastdigital.com",
        "weather.com",
      ]
    },
    {
      msg: "googleapis.com is a PSL TLD",
      domains: DOMAINS.concat([
        "ajax.googleapis.com",
        "maps.googleapis.com",
        "google.com",
      ]),
      expected: [
        "ajax.googleapis.com",
        "betrad.com",
        "c.betrad.com",
        "cloudflare.com",
        "ajax.cloudflare.com",
        "condenastdigital.com",
        "google.com",
        "maps.googleapis.com",
        "weather.com",
      ]
    },
    {
      msg: "non-TLD addresses",
      domains: DOMAINS.concat([
        "localhost",
        "127.0.0.1",
      ]),
      expected: [
        "127.0.0.1",
        "betrad.com",
        "c.betrad.com",
        "cloudflare.com",
        "ajax.cloudflare.com",
        "condenastdigital.com",
        "localhost",
        "weather.com",
      ]
    },

  ];

  tests.forEach((test) => {
    assert.deepEqual(
      htmlUtils.sortDomains(test.domains),
      test.expected,
      test.msg
    );
  });
});

}());
