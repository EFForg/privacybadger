import { extractHostFromURL, getBaseDomain } from "../../lib/basedomain.js";

import { default as surrogatedb } from "../../data/surrogates.js";
import surrogates from "../../js/surrogates.js";
import utils from "../../js/utils.js";

let getSurrogateUri = surrogates.getSurrogateUri;

QUnit.module("Utils", function (/*hooks*/) {

  QUnit.test("explodeSubdomains()", (assert) => {
    let TESTS = [
      {
        desc: "basic",
        fqdn: "test.what.yea.eff.org",
        expected: [
          "test.what.yea.eff.org",
          "what.yea.eff.org",
          "yea.eff.org",
          "eff.org"
        ]
      },
      {
        desc: "multi-dot country code eTLD",
        fqdn: "cdn.bbc.co.uk",
        expected: [
          "cdn.bbc.co.uk",
          "bbc.co.uk"
        ]
      },
      {
        desc: "multi-dot eTLD; `all` is set",
        fqdn: "cdn.bbc.co.uk",
        all: true,
        expected: [
          "cdn.bbc.co.uk",
          "bbc.co.uk",
          "co.uk",
          "uk"
        ]
      },
      {
        desc: "PSL domain",
        fqdn: "storage.googleapis.com",
        expected: [
          "storage.googleapis.com"
        ]
      },
      {
        desc: "PSL domain; `all` is set",
        fqdn: "storage.googleapis.com",
        all: true,
        expected: [
          "storage.googleapis.com",
          "googleapis.com",
          "com"
        ]
      },
      {
        desc: "no dots at all",
        fqdn: "localhost",
        expected: ["localhost"]
      },
      {
        desc: "no dots at all; `all` is set",
        fqdn: "localhost",
        all: true,
        expected: ["localhost"]
      },
      {
        desc: "empty string",
        fqdn: "",
        expected: [""]
      },
      {
        desc: "empty string; `all` is set",
        fqdn: "",
        all: true,
        expected: [""]
      },
    ];
    for (let test of TESTS) {
      let subs = utils.explodeSubdomains(test.fqdn, !!test.all);
      assert.deepEqual(subs, test.expected, test.desc);
    }
  });

  QUnit.module("fetchResource", function (hooks) {
    hooks.beforeEach((/*assert*/) => {
      let delay = function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      };

      let okResp = new Response("test passed\n"),
        notFoundResp = new Response(null, {status: 404});

      // set up fake server to simulate fetch()
      let stubbedFetch = sinon.stub(globalThis, 'fetch');

      stubbedFetch
        .withArgs("https://www.eff.org/files/badgertest.txt")
        .returns(delay(50).then(() => Promise.resolve(okResp)));

      stubbedFetch
        .withArgs("https://example.com")
        // the current Chrome no network error, but we could use anything here
        .rejects(new TypeError("Failed to fetch"));

      // all other URLs
      stubbedFetch
        .returns(delay(50).then(() => Promise.resolve(notFoundResp)));
    });

    hooks.afterEach((/*assert*/) => {
      fetch.restore();
    });

    QUnit.test("successful fetch", function (assert) {
      let done = assert.async();
      utils.fetchResource("https://www.eff.org/files/badgertest.txt", function (err, resp) {
        assert.strictEqual(err, null, "there was no error");
        assert.equal(resp, "test passed\n", "got expected response text");
        done();
      });
    });

    QUnit.test("404 fetch", function (assert) {
      let done = assert.async();
      utils.fetchResource("https://www.eff.org/nonexistent-page", function (err, resp) {
        assert.ok(err, "there was an error");
        if (err) {
          assert.ok(err.toString().endsWith(": 404"), "error was 404");
        }
        assert.strictEqual(resp, null, "there was no response");
        done();
      });
    });

    QUnit.test("no network fetch", function (assert) {
      let done = assert.async();
      utils.fetchResource("https://example.com", function (err, resp) {
        assert.ok(err, "there was an error");
        if (err) {
          assert.equal(err.toString(), "TypeError: Failed to fetch",
            "error message matches");
        }
        assert.strictEqual(resp, null, "there was no response");
        done();
      });
    });
  });

  QUnit.test("isPrivacyBadgerEnabled basic tests", function (assert) {
    assert.ok(badger.isPrivacyBadgerEnabled("example.com"),
      "Domain starts out as enabled.");

    badger.disableOnSite("example.com");
    assert.notOk(badger.isPrivacyBadgerEnabled("example.com"),
      "Disabling the domain works.");

    badger.reenableOnSite("example.com");
    assert.ok(badger.isPrivacyBadgerEnabled("example.com"),
      "Re-enabling the domain works.");
  });

  QUnit.test("isPrivacyBadgerEnabled wildcard tests", function (assert) {
    badger.disableOnSite('*.mail.example.com');
    assert.ok(
      badger.isPrivacyBadgerEnabled('www.example.com'),
      "Ignores cases without as many subdomains as the wildcard."
    );
    assert.ok(
      badger.isPrivacyBadgerEnabled('web.stuff.example.com'),
      "Ignores cases where subdomains do not match the wildcard."
    );
    assert.notOk(
      badger.isPrivacyBadgerEnabled('web.mail.example.com'),
      "Website matches wildcard pattern."
    );
    assert.notOk(
      badger.isPrivacyBadgerEnabled('stuff.fakedomain.web.mail.example.com'),
      "Wildcard catches all prefacing subdomains."
    );
    assert.ok(
      badger.isPrivacyBadgerEnabled('mail.example.com'),
      "Checks against URLs that lack a starting dot."
    );

    const PSL_TLD = "example.googlecode.com";
    assert.equal(getBaseDomain(PSL_TLD), PSL_TLD,
      PSL_TLD + " is a PSL TLD");
    badger.disableOnSite('*.googlecode.com');
    assert.notOk(badger.isPrivacyBadgerEnabled(PSL_TLD),
      "PSL TLDs work with wildcards as expected.");
  });

  QUnit.test("disable/enable privacy badger for origin", function (assert) {
    function parsed() {
      return badger.storage.getStore('settings_map').getItem('disabledSites');
    }

    let origLength = parsed() && parsed().length || 0;

    badger.disableOnSite('foo.com');
    assert.ok(parsed().length == (origLength + 1), "one more disabled site");

    badger.reenableOnSite('foo.com');
    assert.ok(parsed().length == origLength, "one less disabled site");
  });

  QUnit.test("getSurrogateUri() suffix tokens", function (assert) {
    const TEST_FQDN = 'www.google-analytics.com',
      TEST_TOKEN = '/ga.js';

    const TESTS = [
      {
        url: `http://${TEST_FQDN}${TEST_TOKEN}`,
        expected: true,
        msg: "ga.js http URL should match"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}`,
        expected: true,
        msg: "ga.js https URL should match"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=bar`,
        expected: true,
        msg: "ga.js URL with querystring should still match"
      },
      {
        url: `https://${TEST_FQDN}/script${TEST_TOKEN}?foo=bar`,
        expected: true,
        msg: "ga.js URL with some stuff before the match token should still match"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}/more/path`,
        expected: false,
        msg: "should not match (token in path but not at end)"
      },
      {
        url: `https://${TEST_FQDN}/?${TEST_TOKEN}`,
        expected: false,
        msg: "should not match (token in querystring)"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}#foo`,
        expected: true,
        msg: "ga.js URL should still match regardless of trailing hash"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}#?foo=bar`,
        expected: true,
        msg: "ga.js URL should still match if the trailing hash contains ?"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=bar#?foo=bar`,
        expected: true,
        msg: "ga.js URL with querystring and hash should still match"
      },
    ];

    for (let test of TESTS) {
      let surrogate = getSurrogateUri(
        test.url, extractHostFromURL(test.url));
      if (test.expected) {
        assert.ok(surrogate, test.msg);
        if (surrogate) {
          assert.equal(
            surrogate,
            surrogatedb.surrogates[TEST_TOKEN],
            "got the GA surrogate extension URL"
          );
        }
      } else {
        assert.notOk(surrogate, test.msg);
      }
    }

    const NYT_SCRIPT_PATH = '/assets/homepage/20160920-111441/js/foundation/lib/framework.js',
      NYT_URL = 'https://a1.nyt.com' + NYT_SCRIPT_PATH;

    // test negative match
    assert.notOk(
      getSurrogateUri(NYT_URL, extractHostFromURL(NYT_URL)),
      "New York Times script URL should not match any surrogates"
    );

    // test surrogate suffix token response contents
    surrogatedb.hostnames[extractHostFromURL(NYT_URL)] = {
      match: surrogatedb.MATCH_SUFFIX,
      tokens: [
        NYT_SCRIPT_PATH
      ]
    };
    surrogatedb.surrogates[NYT_SCRIPT_PATH] = surrogatedb.surrogates.noopjs;
    assert.equal(
      getSurrogateUri(NYT_URL, extractHostFromURL(NYT_URL)),
      surrogatedb.surrogates.noopjs,
      "New York Times script URL should now match the noop surrogate"
    );
  });

  QUnit.test("getSurrogateUri() prefix tokens", function (assert) {
    const TEST_FQDN = "www.example.com",
      TEST_TOKEN = "/foo";

    const TESTS = [
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?bar`,
        expected: true,
        msg: "token at start of path should match"
      },
      {
        url: `https://${getBaseDomain(TEST_FQDN)}${TEST_TOKEN}`,
        expected: false,
        msg: "should not match (same base domain, but different FQDN)"
      },
      {
        url: `https://${TEST_FQDN}/bar${TEST_TOKEN}/bar`,
        expected: false,
        msg: "should not match (token in path but not at start)"
      },
      {
        url: `https://${TEST_FQDN}/bar${TEST_TOKEN}`,
        expected: false,
        msg: "should not match (token in path but at end)"
      },
      {
        url: `https://${TEST_FQDN}/?${TEST_TOKEN}`,
        expected: false,
        msg: "should not match (token in querystring)"
      },
    ];

    // set up test data for prefix token tests
    surrogatedb.hostnames[TEST_FQDN] = {
      match: surrogatedb.MATCH_PREFIX,
      tokens: [TEST_TOKEN]
    };
    surrogatedb.surrogates[TEST_TOKEN] = surrogatedb.surrogates.noopjs;

    for (let test of TESTS) {
      let surrogate = getSurrogateUri(test.url, extractHostFromURL(test.url));
      if (test.expected) {
        assert.ok(surrogate, test.msg);
        if (surrogate) {
          assert.equal(surrogate, surrogatedb.surrogates.noopjs,
            "got the noop surrogate extension URL");
        }
      } else {
        assert.notOk(surrogate, test.msg);
      }
    }
  });

  QUnit.test("getSurrogateUri() prefix tokens with querystring parameters", function (assert) {
    const TEST_FQDN = "www.example.com",
      TEST_TOKEN = "/foo";

    const TESTS = [
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=bar`,
        params: {
          foo: true
        },
        expected: true,
        msg: "foo is present"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?another=123`,
        params: {
          foo: true
        },
        expected: false,
        msg: "foo is missing"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=baz`,
        params: {
          foo: true
        },
        expected: true,
        msg: "foo is present with some other value"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=baz`,
        params: {
          foo: "baz"
        },
        expected: true,
        msg: "foo is present with expected value"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=bar`,
        params: {
          foo: "baz"
        },
        expected: false,
        msg: "foo is present with unexpected value"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?another=123&foo=bar`,
        params: {
          another: true,
          foo: "bar"
        },
        expected: true,
        msg: "two parameters match"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=bar&another=123`,
        params: {
          another: true,
          foo: "bar"
        },
        expected: true,
        msg: "order shouldn't matter"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?another=123&foo=bar`,
        params: {
          another: true,
          foo: "baz"
        },
        expected: false,
        msg: "two parameters, one fails to match"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?foo=baz`,
        params: {
          another: true,
          foo: "baz"
        },
        expected: false,
        msg: "two parameters, one is missing"
      },
      {
        url: `https://${TEST_FQDN}${TEST_TOKEN}?another=123&foo=baz`,
        params: {
          foo: "baz",
        },
        expected: true,
        msg: "unspecified parameters are ignored"
      },
    ];

    // set up test data for prefix token tests
    surrogatedb.surrogates[TEST_TOKEN] = surrogatedb.surrogates.noopjs;

    for (let test of TESTS) {
      // update test data with querystring parameter rules for current test
      surrogatedb.hostnames[TEST_FQDN] = {
        match: surrogatedb.MATCH_PREFIX_WITH_PARAMS,
        params: test.params,
        tokens: [TEST_TOKEN]
      };

      let surrogate = getSurrogateUri(test.url, extractHostFromURL(test.url));
      if (test.expected) {
        assert.ok(surrogate, test.msg);
        if (surrogate) {
          assert.equal(surrogate, surrogatedb.surrogates.noopjs,
            "got the noop surrogate extension URL");
        }
      } else {
        assert.notOk(surrogate, test.msg);
      }
    }
  });

  QUnit.test("getSurrogateUri() wildcard tokens", function (assert) {
    // set up test data for wildcard token tests
    surrogatedb.hostnames['cdn.example.com'] = {
      match: surrogatedb.MATCH_ANY,
      token: 'noopjs'
    };

    // https://stackoverflow.com/a/11935263
    function get_random_subarray(arr, size) {
      let shuffled = arr.slice(0),
        i = arr.length,
        min = i - size,
        temp, index;
      while (i-- > min) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
      }
      return shuffled.slice(min);
    }

    // test wildcard tokens
    for (let i = 0; i < 25; i++) {
      let url = 'http://cdn.example.com/' + get_random_subarray(
        'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
        utils.random(5, 15)
      ).join('');

      assert.equal(
        getSurrogateUri(url, extractHostFromURL(url)),
        surrogatedb.surrogates.noopjs,
        "A wildcard token should match all URLs for the hostname: " + url
      );
    }
  });

  QUnit.test("rateLimit", (assert) => {
    const INTERVAL = 100,
      NUM_TESTS = 5;

    let clock = sinon.useFakeTimers(+new Date());

    let callback = sinon.spy(function (password, i) {
      // check args
      assert.equal(password, "qwerty",
        "rateLimit should preserve args");
      assert.equal(i + 1, callback.callCount,
        "rateLimit should preserve args and call order");

      // check context
      assert.ok(this.foo == "bar", "rateLimit should preserve context");
    });

    let fn = utils.rateLimit(callback, INTERVAL, {foo:"bar"});

    for (let i = 0; i < NUM_TESTS; i++) {
      fn("qwerty", i);
    }

    for (let i = 0; i < NUM_TESTS; i++) {
      // check rate limiting
      assert.equal(callback.callCount, i + 1,
        "rateLimit should allow only one call per interval");

      // advance the clock
      clock.tick(INTERVAL);
    }

    clock.restore();
  });

  // the following cookie parsing tests are derived from
  // https://github.com/jshttp/cookie/blob/81bd3c77db6a8dcb23567de94b3beaef6c03e97a/test/parse.js
  QUnit.test("cookie parsing", function (assert) {

    assert.deepEqual(utils.parseCookie('foo=bar'), { foo: 'bar' },
      "simple cookie");

    assert.deepEqual(
      utils.parseCookie('foo=bar;bar=123'),
      {
        foo: 'bar',
        bar: '123'
      },
      "simple cookie with two values"
    );

    assert.deepEqual(
      utils.parseCookie('FOO    = bar;   baz  =   raz'),
      {
        FOO: 'bar',
        baz: 'raz'
      },
      "ignore spaces"
    );

    assert.deepEqual(
      utils.parseCookie('foo="bar=123456789&name=Magic+Mouse"'),
      { foo: 'bar=123456789&name=Magic+Mouse' },
      "escaped value"
    );

    assert.deepEqual(
      utils.parseCookie('email=%20%22%2c%3b%2f'),
      { email: ' ",;/' },
      "encoded value"
    );

    assert.deepEqual(
      utils.parseCookie('foo=%1;bar=bar'),
      {
        foo: '%1',
        bar: 'bar'
      },
      "ignore escaping error and return original value"
    );

    assert.deepEqual(
      utils.parseCookie('foo=%1;bar=bar;HttpOnly;Secure', { skipNonValues: true }),
      {
        foo: '%1',
        bar: 'bar'
      },
      "ignore non values"
    );

    assert.deepEqual(
      utils.parseCookie('priority=true; expires=Wed, 29 Jan 2014 17:43:25 GMT; Path=/'),
      {
        priority: 'true',
        expires: 'Wed, 29 Jan 2014 17:43:25 GMT',
        Path: '/'
      },
      "dates"
    );

    assert.deepEqual(
      utils.parseCookie('foo=%1;bar=bar;foo=boo', { noOverwrite: true}),
      {
        foo: '%1',
        bar: 'bar'
      },
      "duplicate names #1"
    );

    assert.deepEqual(
      utils.parseCookie('foo=false;bar=bar;foo=true', { noOverwrite: true}),
      {
        foo: 'false',
        bar: 'bar'
      },
      "duplicate names #2"
    );

    assert.deepEqual(
      utils.parseCookie('foo=;bar=bar;foo=boo', { noOverwrite: true}),
      {
        foo: '',
        bar: 'bar'
      },
      "duplicate names #3"
    );

    // SameSite attribute
    let SAMESITE_COOKIE = 'abc=123; path=/; domain=.githack.com; HttpOnly; SameSite=Lax';
    assert.deepEqual(
      utils.parseCookie(SAMESITE_COOKIE),
      {
        abc: '123',
        SameSite: 'Lax',
        path: '/',
        domain: '.githack.com',
        HttpOnly: '',
      },
      "SameSite is parsed"
    );
    assert.deepEqual(
      utils.parseCookie(SAMESITE_COOKIE, { skipAttributes: true }),
      { abc: '123' },
      "SameSite is ignored when ignoring attributes"
    );

  });

  QUnit.test("cookie parsing (legacy Firefox add-on)", function (assert) {
    // raw cookies (input)
    let optimizelyCookie = 'optimizelyEndUserId=oeu1394241144653r0.538161732205'+
      '5392; optimizelySegments=%7B%22237061344%22%3A%22none%22%2C%22237321400%'+
      '22%3A%22ff%22%2C%22237335298%22%3A%22search%22%2C%22237485170%22%3A%22fa'+
      'lse%22%7D; optimizelyBuckets=%7B%7D';
    let googleCookie = 'PREF=ID=d93d4e842d10e12a:U=3838eaea5cd40d37:FF=0:TM=139'+
      '4232126:LM=1394235924:S=rKP367ac3aAdDzAS; NID=67=VwhHOGQunRmNsm9WwJyK571'+
      'OGqb3RtvUmH987K5DXFgKFAxFwafA_5VPF5_bsjhrCoM0BjyQdxyL2b-qs9b-fmYCQ_1Uqjt'+
      'qTeidAJBnc2ecjewJia6saHrcJ6yOVVgv';
    let hackpadCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
      'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; expires=Wed, 01-Jan-3000 08:00:01 G'+
      'MT; domain=.hackpad.com; path=/; secure; httponly\nacctIds=%5B%22mIqZhIP'+
      'Mu7j%22%2C%221394477194%22%2C%22uT/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; ex'+
      'pires=Wed, 01-Jan-3000 08:00:00 GMT; domain=.hackpad.com; path=/; secure'+
      '; httponly\n1ASIE=T; expires=Wed, 01-Jan-3000 08:00:00 GMT; domain=hackp'+
      'ad.com; path=/\nPUAS3=3186efa7f8bca99c; expires=Wed, 01-Jan-3000 08:00:0'+
      '0 GMT; path=/; secure; httponly';
    let emptyCookie = '';
    let testCookie = ' notacookiestring; abc=123 ';

    // parsed cookies (expected output)
    let COOKIES = {};
    COOKIES[optimizelyCookie] = {
      optimizelyEndUserId: 'oeu1394241144653r0.5381617322055392',
      optimizelySegments: '%7B%22237061344%22%3A%22none%22%2C%22237321400%2' +
        '2%3A%22ff%22%2C%22237335298%22%3A%22search%22%2C%22237485170%22%3A%2' +
        '2false%22%7D',
      optimizelyBuckets: '%7B%7D'
    };
    COOKIES[emptyCookie] = {};
    COOKIES[testCookie] = {abc: '123'};
    COOKIES[googleCookie] = {
      PREF: 'ID=d93d4e842d10e12a:U=3838eaea5cd40d37:FF=0:TM=1394232126:LM=1'+
        '394235924:S=rKP367ac3aAdDzAS',
      NID: '67=VwhHOGQunRmNsm9WwJyK571OGqb3RtvUmH987K5DXFgKFAxFwafA_5VPF5_b'+
        'sjhrCoM0BjyQdxyL2b-qs9b-fmYCQ_1UqjtqTeidAJBnc2ecjewJia6saHrcJ6yOVVgv'
    };
    COOKIES[hackpadCookie] = {
      acctIds: '%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22uT/ayZECO0g/+h'+
        'HtQnjrdEZivWA%3D%22%5D',
      PUAS3: '3186efa7f8bca99c',
      '1ASIE': 'T'
    };

    // compare actual to expected
    let test_number = 0;
    for (let cookie_str in COOKIES) {
      if (utils.hasOwn(COOKIES, cookie_str)) {
        test_number++;

        let expected = COOKIES[cookie_str];

        let actual = utils.parseCookie(
          cookie_str, {
            noDecode: true,
            skipAttributes: true,
            skipNonValues: true
          }
        );

        assert.deepEqual(actual, expected, "cookie test #" + test_number);
      }
    }
  });

  // the following cookie parsing tests are derived from
  // https://github.com/yui/yui3/blob/25264e3629b1c07fb779d203c4a25c0879ec862c/src/cookie/tests/cookie-tests.js
  QUnit.test("cookie parsing (YUI3)", function (assert) {

    let cookieString = "a=b";
    let cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "a"), "Cookie 'a' is present.");
    assert.equal(cookies.a, "b", "Cookie 'a' should have value 'b'.");

    cookieString = "12345=b";
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "12345"), "Cookie '12345' is present.");
    assert.equal(cookies["12345"], "b", "Cookie '12345' should have value 'b'.");

    cookieString = "a=b; c=d; e=f; g=h";
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "a"), "Cookie 'a' is present.");
    assert.ok(utils.hasOwn(cookies, "c"), "Cookie 'c' is present.");
    assert.ok(utils.hasOwn(cookies, "e"), "Cookie 'e' is present.");
    assert.ok(utils.hasOwn(cookies, "g"), "Cookie 'g' is present.");
    assert.equal(cookies.a, "b", "Cookie 'a' should have value 'b'.");
    assert.equal(cookies.c, "d", "Cookie 'c' should have value 'd'.");
    assert.equal(cookies.e, "f", "Cookie 'e' should have value 'f'.");
    assert.equal(cookies.g, "h", "Cookie 'g' should have value 'h'.");

    cookieString = "name=Nicholas%20Zakas; title=front%20end%20engineer";
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "name"), "Cookie 'name' is present.");
    assert.ok(utils.hasOwn(cookies, "title"), "Cookie 'title' is present.");
    assert.equal(cookies.name, "Nicholas Zakas", "Cookie 'name' should have value 'Nicholas Zakas'.");
    assert.equal(cookies.title, "front end engineer", "Cookie 'title' should have value 'front end engineer'.");

    cookieString = "B=2nk0a3t3lj7cr&b=3&s=13; LYC=l_v=2&l_lv=10&l_l=94ddoa70d&l_s=qz54t4qwrsqquyv51w0z4xxwtx31x1t0&l_lid=146p1u6&l_r=4q&l_lc=0_0_0_0_0&l_mpr=50_0_0&l_um=0_0_1_0_0;YMRAD=1215072198*0_0_7318647_1_0_40123839_1; l%5FPD3=840";
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "B"), "Cookie 'B' is present.");
    assert.ok(utils.hasOwn(cookies, "LYC"), "Cookie 'LYC' is present.");
    assert.ok(utils.hasOwn(cookies, "l_PD3"), "Cookie 'l_PD3' is present.");

    let cookieName = "something[1]";
    let cookieValue = "123";
    cookieString = encodeURIComponent(cookieName) + "=" + encodeURIComponent(cookieValue);
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, cookieName), "Cookie '" + cookieName + "' is present.");
    assert.equal(cookies[cookieName], cookieValue, "Cookie value for '" + cookieName + "' is " + cookieValue + ".");

    cookieString = "SESSION=27bedbdf3d35252d0db07f34d81dcca6; STATS=OK; SCREEN=1280x1024; undefined; ys-bottom-preview=o%3Aheight%3Dn%253A389";
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "SCREEN"), "Cookie 'SCREEN' is present.");
    assert.ok(utils.hasOwn(cookies, "STATS"), "Cookie 'STATS' is present.");
    assert.ok(utils.hasOwn(cookies, "SESSION"), "Cookie 'SESSION' is present.");
    assert.ok(utils.hasOwn(cookies, "ys-bottom-preview"), "Cookie 'ys-bottom-preview' is present.");
    assert.ok(utils.hasOwn(cookies, "undefined"), "Cookie 'undefined' is present.");

    // Tests that cookie parsing deals with cookies that contain an invalid
    // encoding. It shouldn't error, but should treat the cookie as if it
    // doesn't exist (return null).
    cookieString = "DetailInfoList=CPN03022194=@|@=CPN03#|#%B4%EB%C3%B5%C7%D8%BC%F6%BF%E5%C0%E5#|#1016026000#|#%BD%C5%C8%E6%B5%BF#|##|#";
    cookies = utils.parseCookie(cookieString, { skipInvalid: true });
    assert.equal(cookies.DetailInfoList, null, "Cookie 'DetailInfoList' should not have a value.");

    // Tests that a Boolean cookie, one without an equals sign of value,
    // is represented as an empty string.
    cookieString = "info";
    cookies = utils.parseCookie(cookieString);
    assert.equal(cookies.info, "", "Cookie 'info' should be an empty string.");

    cookieString = "name=Nicholas%20Zakas; hash=a=b&c=d&e=f&g=h; title=front%20end%20engineer";
    cookies = utils.parseCookie(cookieString);
    assert.ok(utils.hasOwn(cookies, "name"), "Cookie 'name' is present.");
    assert.ok(utils.hasOwn(cookies, "hash"), "Cookie 'hash' is present.");
    assert.ok(utils.hasOwn(cookies, "title"), "Cookie 'title' is present.");
    assert.equal(cookies.name, "Nicholas Zakas", "Cookie 'name' should have value 'Nicholas Zakas'.");
    assert.equal(cookies.hash, "a=b&c=d&e=f&g=h", "Cookie 'hash' should have value 'a=b&c=d&e=f&g=h'.");
    assert.equal(cookies.title, "front end engineer", "Cookie 'title' should have value 'front end engineer'.");

  });

  QUnit.test("getHostFromDomainInput", assert => {
    assert.equal(utils.getHostFromDomainInput("www.spiegel.de"),
      "www.spiegel.de",
      "Valid domains are accepted");

    assert.equal(utils.getHostFromDomainInput("http://www.spiegel.de/"),
      "www.spiegel.de",
      "URLs get transformed into domains");

    assert.equal(utils.getHostFromDomainInput("http://www.spiegel.de"),
      "www.spiegel.de",
      "Trailing slashes are not required");

    assert.notOk(utils.getHostFromDomainInput("@"),
      "Valid URIs with empty hosts are rejected");

    assert.equal(utils.getHostFromDomainInput("httpbin.org"),
      "httpbin.org",
      "Domains that begin with http are valid entries");
  });

  // used in pixel tracking heuristic, given a string the estimateMaxEntropy function
  // will return the estimated entropy value from it, based on logic parsing the string's length,
  // and classes of character complication included in the string
  QUnit.test("estimateMaxEntropy", assert => {
    assert.equal(
      utils.estimateMaxEntropy("google.com/analytics.google/analytics.google/google.com/analytics.google/analytics.google/google.com/analytics.google/analytics.google/google.com/analytics.google/analytics.google/google.com/analytics.google/analytics.google/google.com/analytics.google/anal"),
      257,
      "returns length of string if it's above 256 (MAX_LS_LEN_FOR_ENTROPY_EST)"
    );

    assert.equal(
      utils.estimateMaxEntropy("googlecomanalytics"),
      utils.estimateMaxEntropy("GOOGLECOMANALYTICS"),
      "if the same string is all lower case or all upper case, the returned estimated entropy value is the same"
    );

    assert.notEqual(
      utils.estimateMaxEntropy('analytics.GOOGLE1234_'),
      utils.estimateMaxEntropy('ANALYTICS.google1234'),
      "two nearly identical strings of mixed character classes and different cases will return different values"
    );

    assert.notEqual(
      utils.estimateMaxEntropy('google.com/analytics'),
      utils.estimateMaxEntropy('0191/_-goo~le9x+xzxo'),
      "strings of the same length but from different character classes will estimate different entropy values"
    );

    assert.equal(
      utils.estimateMaxEntropy("google.com/0191/_-google/analytics.fizz?buzz=foobar"),
      320.55551316197466,
      "entropy for complex string of varying character classes is correctly estimated"
    );

    assert.equal(
      utils.estimateMaxEntropy("03899029.01_293"),
      49.82892142331044,
      "entropy for string from the common classes of characters is correctly estimated"
    );

    assert.equal(
      utils.estimateMaxEntropy("fizzBUZZ012345"),
      84,
      "entropy for string from the case-insensitive class of characters is correctly estimated"
    );

    assert.equal(
      utils.estimateMaxEntropy("fizz/buzz+fizzy~buzzy%"),
      142.82076811925285,
      "entropy for string from the case-sensitive class of characters is correctly estimated"
    );

    assert.equal(
      utils.estimateMaxEntropy("1280x720") < 32,
      true,
      "resolution strings with 'x' char from SEPS class are correctly estimated as low entropy"
    );

  });

  QUnit.test("firstPartyProtectionsEnabled", assert => {
    assert.ok(
      utils.firstPartyProtectionsEnabled("www.google.com"),
      "properly identifies a url pattern from our firstparties list"
    );

    assert.ok(
      utils.firstPartyProtectionsEnabled("www.google.co.uk"),
      "properly identifies a url pattern from our firstparties list"
    );

    assert.notOk(
      utils.firstPartyProtectionsEnabled("foobar.com"),
      "determines that a url not in the firstparties list is not protected by a firstparty script"
    );

    assert.ok(
      utils.firstPartyProtectionsEnabled("www.messenger.com"),
      "accurately IDs a site with firstparty protections covered by a wildcard url match"
    );

    assert.ok(
      utils.firstPartyProtectionsEnabled("www.facebook.com"),
      "wildcard pattern matching"
    );

    assert.ok(
      utils.firstPartyProtectionsEnabled("m.facebook.com"),
      "wildcard pattern matching"
    );

    assert.notOk(
      utils.firstPartyProtectionsEnabled("acebook.com"),
      "wildcard pattern matching"
    );
  });

});
