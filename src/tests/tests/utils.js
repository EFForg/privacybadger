/* globals badger:false */

(function() {

QUnit.module("Utils");

var utils = require('utils');
var getSurrogateURI = require('surrogates').getSurrogateURI;

QUnit.test("explodeSubdomains", function (assert) {
  var fqdn = "test.what.yea.eff.org";
  var subs = utils.explodeSubdomains(fqdn);
  assert.equal(subs.length, 4);
  assert.equal(subs[0], fqdn);
  assert.equal(subs[3], "eff.org");
});

QUnit.test("xhrRequest", function (assert) {
  // set up fake server to simulate XMLHttpRequests
  let server = sinon.fakeServer.create({
    respondImmediately: true
  });
  server.respondWith("GET", "https://www.eff.org/files/badgertest.txt",
    [200, {}, "test passed\n"]);

  let done = assert.async();
  assert.expect(4);

  utils.xhrRequest("https://www.eff.org/files/badgertest.txt", function (err1, resp) {
    assert.strictEqual(err1, null, "there was no error");
    assert.equal(resp, "test passed\n", "got expected response text");

    utils.xhrRequest("https://www.eff.org/nonexistent-page", function(err2/*, resp*/) {
      assert.ok(err2, "there was an error");
      assert.equal(err2.status, 404, "error was 404");

      server.restore();
      done();
    });
  });
});

QUnit.test("isPrivacyBadgerEnabled basic tests", function (assert) {
  assert.ok(badger.isPrivacyBadgerEnabled("example.com"),
    "Domain starts out as enabled.");

  badger.disablePrivacyBadgerForOrigin("example.com");
  assert.notOk(badger.isPrivacyBadgerEnabled("example.com"),
    "Disabling the domain works.");

  badger.enablePrivacyBadgerForOrigin("example.com");
  assert.ok(badger.isPrivacyBadgerEnabled("example.com"),
    "Re-enabling the domain works.");
});

QUnit.test("isPrivacyBadgerEnabled wildcard tests", function (assert) {
  badger.disablePrivacyBadgerForOrigin('*.mail.example.com');
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
  assert.equal(window.getBaseDomain(PSL_TLD), PSL_TLD,
    PSL_TLD + " is a PSL TLD");
  badger.disablePrivacyBadgerForOrigin('*.googlecode.com');
  assert.notOk(badger.isPrivacyBadgerEnabled(PSL_TLD),
    "PSL TLDs work with wildcards as expected.");
});

QUnit.test("disable/enable privacy badger for origin", function (assert) {
  function parsed() {
    return badger.storage.getBadgerStorageObject('settings_map').getItem('disabledSites');
  }

  let origLength = parsed() && parsed().length || 0;

  badger.disablePrivacyBadgerForOrigin('foo.com');
  assert.ok(parsed().length == (origLength + 1), "one more disabled site");

  badger.enablePrivacyBadgerForOrigin('foo.com');
  assert.ok(parsed().length == origLength, "one less disabled site");
});

QUnit.test("surrogate script URL lookups", function (assert) {
  const surrogatedb = require('surrogatedb');
  const SURROGATE_PREFIX = 'data:application/javascript;base64,';
  const GA_JS_TESTS = [
    {
      url: 'http://www.google-analytics.com/ga.js',
      msg: "Google Analytics ga.js http URL should match"
    },
    {
      url: 'https://www.google-analytics.com/ga.js',
      msg: "Google Analytics ga.js https URL should match"
    },
    {
      url: 'https://www.google-analytics.com/ga.js?foo=bar',
      msg: "Google Analytics ga.js querystring URL should match"
    },
  ];
  const NYT_SCRIPT_PATH = '/assets/homepage/20160920-111441/js/foundation/lib/framework.js';
  const NYT_URL = 'https://a1.nyt.com' + NYT_SCRIPT_PATH;

  let ga_js_surrogate;

  for (let i = 0; i < GA_JS_TESTS.length; i++) {
    ga_js_surrogate = getSurrogateURI(
      GA_JS_TESTS[i].url,
      'www.google-analytics.com'
    );
    assert.ok(ga_js_surrogate, GA_JS_TESTS[i].msg);
  }

  assert.ok(
    ga_js_surrogate.startsWith(SURROGATE_PREFIX),
    "The returned ga.js surrogate is a base64-encoded JavaScript data URI"
  );

  // test negative match
  assert.notOk(
    getSurrogateURI(NYT_URL, window.extractHostFromURL(NYT_URL)),
    "New York Times script URL should not match any surrogates"
  );

  // test surrogate suffix token response contents
  surrogatedb.hostnames[window.extractHostFromURL(NYT_URL)] = [
    NYT_SCRIPT_PATH
  ];
  surrogatedb.surrogates[NYT_SCRIPT_PATH] = _.noop;
  assert.equal(
    getSurrogateURI(NYT_URL, window.extractHostFromURL(NYT_URL)),
    SURROGATE_PREFIX + btoa(_.noop),
    "New York Times script URL should now match the _.noop surrogate"
  );

  // set up test data for wildcard token tests
  surrogatedb.hostnames['cdn.example.com'] = 'noop';
  surrogatedb.surrogates.noop = _.noop;

  // test wildcard tokens
  for (let i = 0; i < 25; i++) {
    let url = 'http://cdn.example.com/' + _.sample(
      'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
      _.random(5, 15)
    ).join('');

    assert.equal(
      getSurrogateURI(url, window.extractHostFromURL(url)),
      SURROGATE_PREFIX + btoa(_.noop),
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
  for (let cookieString in COOKIES) {
    if (COOKIES.hasOwnProperty(cookieString)) {
      test_number++;

      let expected = COOKIES[cookieString];

      let actual = utils.parseCookie(
        cookieString, {
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
  assert.ok(cookies.hasOwnProperty("a"), "Cookie 'a' is present.");
  assert.equal(cookies.a, "b", "Cookie 'a' should have value 'b'.");

  cookieString = "12345=b";
  cookies = utils.parseCookie(cookieString);
  assert.ok(cookies.hasOwnProperty("12345"), "Cookie '12345' is present.");
  assert.equal(cookies["12345"], "b", "Cookie '12345' should have value 'b'.");

  cookieString = "a=b; c=d; e=f; g=h";
  cookies = utils.parseCookie(cookieString);
  assert.ok(cookies.hasOwnProperty("a"), "Cookie 'a' is present.");
  assert.ok(cookies.hasOwnProperty("c"), "Cookie 'c' is present.");
  assert.ok(cookies.hasOwnProperty("e"), "Cookie 'e' is present.");
  assert.ok(cookies.hasOwnProperty("g"), "Cookie 'g' is present.");
  assert.equal(cookies.a, "b", "Cookie 'a' should have value 'b'.");
  assert.equal(cookies.c, "d", "Cookie 'c' should have value 'd'.");
  assert.equal(cookies.e, "f", "Cookie 'e' should have value 'f'.");
  assert.equal(cookies.g, "h", "Cookie 'g' should have value 'h'.");

  cookieString = "name=Nicholas%20Zakas; title=front%20end%20engineer";
  cookies = utils.parseCookie(cookieString);
  assert.ok(cookies.hasOwnProperty("name"), "Cookie 'name' is present.");
  assert.ok(cookies.hasOwnProperty("title"), "Cookie 'title' is present.");
  assert.equal(cookies.name, "Nicholas Zakas", "Cookie 'name' should have value 'Nicholas Zakas'.");
  assert.equal(cookies.title, "front end engineer", "Cookie 'title' should have value 'front end engineer'.");

  cookieString = "B=2nk0a3t3lj7cr&b=3&s=13; LYC=l_v=2&l_lv=10&l_l=94ddoa70d&l_s=qz54t4qwrsqquyv51w0z4xxwtx31x1t0&l_lid=146p1u6&l_r=4q&l_lc=0_0_0_0_0&l_mpr=50_0_0&l_um=0_0_1_0_0;YMRAD=1215072198*0_0_7318647_1_0_40123839_1; l%5FPD3=840";
  cookies = utils.parseCookie(cookieString);
  assert.ok(cookies.hasOwnProperty("B"), "Cookie 'B' is present.");
  assert.ok(cookies.hasOwnProperty("LYC"), "Cookie 'LYC' is present.");
  assert.ok(cookies.hasOwnProperty("l_PD3"), "Cookie 'l_PD3' is present.");

  let cookieName = "something[1]";
  let cookieValue = "123";
  cookieString = encodeURIComponent(cookieName) + "=" + encodeURIComponent(cookieValue);
  cookies = utils.parseCookie(cookieString);
  assert.ok(cookies.hasOwnProperty(cookieName), "Cookie '" + cookieName + "' is present.");
  assert.equal(cookies[cookieName], cookieValue, "Cookie value for '" + cookieName + "' is " + cookieValue + ".");

  cookieString = "SESSION=27bedbdf3d35252d0db07f34d81dcca6; STATS=OK; SCREEN=1280x1024; undefined; ys-bottom-preview=o%3Aheight%3Dn%253A389";
  cookies = utils.parseCookie(cookieString);
  assert.ok(cookies.hasOwnProperty("SCREEN"), "Cookie 'SCREEN' is present.");
  assert.ok(cookies.hasOwnProperty("STATS"), "Cookie 'STATS' is present.");
  assert.ok(cookies.hasOwnProperty("SESSION"), "Cookie 'SESSION' is present.");
  assert.ok(cookies.hasOwnProperty("ys-bottom-preview"), "Cookie 'ys-bottom-preview' is present.");
  assert.ok(cookies.hasOwnProperty("undefined"), "Cookie 'undefined' is present.");

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
  assert.ok(cookies.hasOwnProperty("name"), "Cookie 'name' is present.");
  assert.ok(cookies.hasOwnProperty("hash"), "Cookie 'hash' is present.");
  assert.ok(cookies.hasOwnProperty("title"), "Cookie 'title' is present.");
  assert.equal(cookies.name, "Nicholas Zakas", "Cookie 'name' should have value 'Nicholas Zakas'.");
  assert.equal(cookies.hash, "a=b&c=d&e=f&g=h", "Cookie 'hash' should have value 'a=b&c=d&e=f&g=h'.");
  assert.equal(cookies.title, "front end engineer", "Cookie 'title' should have value 'front end engineer'.");

});

QUnit.test("getHostFromDomainInput", assert => {
  assert.equal(
    utils.getHostFromDomainInput("www.spiegel.de"),
    "www.spiegel.de",
    "Valid domains are accepted"
  );

  assert.equal(
    utils.getHostFromDomainInput("http://www.spiegel.de/"),
    "www.spiegel.de",
    "URLs get transformed into domains"
  );

  assert.equal(
    utils.getHostFromDomainInput("http://www.spiegel.de"),
    "www.spiegel.de",
    "Trailing slashes are not required"
  );

  assert.equal(
    utils.getHostFromDomainInput("@"),
    false,
    "Valid URIs with empty hosts are rejected."
  );
});

})();
