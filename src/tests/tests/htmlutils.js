import constants from "../../js/constants.js";
import htmlUtils from "../../js/htmlutils.js";

QUnit.module("HTML Utils");

QUnit.test("getActionDescription", (assert) => {
  const getMessage = chrome.i18n.getMessage,
    fqdn = "example.com";

  const tests = [
    {
      action: constants.BLOCK,
      fqdn,
      expectedResult: getMessage('badger_status_block', fqdn)
    },
    {
      action: constants.COOKIEBLOCK,
      fqdn,
      expectedResult: getMessage('badger_status_cookieblock', fqdn)
    },
    {
      action: constants.ALLOW,
      fqdn,
      expectedResult: getMessage('badger_status_allow', fqdn)
    },
    {
      action: constants.USER_BLOCK,
      fqdn,
      expectedResult: getMessage('badger_status_block', fqdn)
    },
    {
      action: constants.USER_COOKIEBLOCK,
      fqdn,
      expectedResult: getMessage('badger_status_cookieblock', fqdn)
    },
    {
      action: constants.USER_COOKIEBLOCK,
      fqdn,
      blockedFpScripts: ['/fp.min.js'],
      expectedResult: getMessage('badger_status_blocked_scripts', fqdn)
    },
    {
      action: constants.USER_ALLOW,
      fqdn,
      expectedResult: getMessage('badger_status_allow', fqdn)
    },
    {
      action: "dnt",
      fqdn,
      expectedResult: getMessage('dnt_tooltip')
    },
  ];

  for (let test of tests) {
    assert.equal(
      htmlUtils.getActionDescription(
        test.action, test.fqdn, test.blockedFpScripts),
      test.expectedResult,
      `Inputs: '${test.action}' and '${test.fqdn}'`
    );
  }
});

QUnit.test("getToggleHtml", function (assert) {
  // Test parameters
  const domain = "pbtest.org";
  const tests = [
    {
      action: constants.BLOCK,
      expectedResult: constants.BLOCK,
    },
    {
      action: constants.COOKIEBLOCK,
      expectedResult: constants.COOKIEBLOCK,
    },
    {
      action: constants.ALLOW,
      expectedResult: constants.ALLOW,
    },
    {
      action: constants.DNT,
      expectedResult: constants.ALLOW,
    },
  ];

  // Run each test.
  for (let test of tests) {
    let message = `Inputs: '${domain}' and '${test.action}'`;
    let html = htmlUtils.getToggleHtml(domain, test.action);
    let input_val = $('input[name="' + domain + '"]:checked', html).val();
    assert.equal(input_val, test.expectedResult, message);
  }
});

QUnit.test("getOriginHtml", function (assert) {
  // Test parameters
  var tests = [
    {
      existingHtml: '<div id="existinghtml"></div>',
      domain: "pbtest.org",
      action: constants.ALLOW,
    },
    {
      existingHtml: '<div id="existinghtml"></div>',
      domain: "pbtest.org",
      action: constants.DNT,
    },
  ];

  // Run each test.
  for (let test of tests) {
    let existing_html = test.existingHtml,
      domain = test.domain,
      action = test.action;

    let result_html = existing_html + htmlUtils.getOriginHtml(domain, action);

    // Make sure existing HTML is present.
    let html_found = result_html.includes(existing_html);
    assert.ok(html_found, "Existing HTML should be present");

    // Make sure domain is set.
    let dataset_prop_found = result_html.includes('data-origin="' + domain + '"');
    assert.ok(dataset_prop_found, "Domain should be set");

    // Check for presence of DNT content.
    let dnt_found = result_html.includes('class="dnt-compliant"');
    assert.equal(dnt_found, action == constants.DNT,
      "DNT div should " + (dnt_found ? "" : "not ") + "be present");
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
