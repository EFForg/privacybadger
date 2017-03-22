/* globals badger:false */

(function() {
  QUnit.module("Utils");

  var utils = require('utils');
  var getSurrogateURI = require('surrogates').getSurrogateURI;
  var mdfp = require('multiDomainFP');

  QUnit.test("removeElementFromArray", function (assert) {
    var testAry = [1,2,3,4,5,6];
    utils.removeElementFromArray(testAry,2);
    assert.ok(testAry.length === 5, "Array length is 5");
    assert.ok(testAry.indexOf(3) === -1, "second element has been deleted");
    assert.ok(testAry[2] === 4);
  });

  QUnit.test("removeElementsFromArray", function (assert) {
    var testAry = [1,2,3,4,5,6];
    utils.removeElementFromArray(testAry,2, 4);
    assert.ok(testAry.length === 3, "Array length is 3");
    assert.ok(testAry.indexOf(3) === -1, "second element deleted");
    assert.ok(testAry.indexOf(4) === -1, "third element deleted");
    assert.ok(testAry.indexOf(5) === -1, "fourth element deleted");
    assert.ok(testAry[2] === 6, "correct value at idx 2");
  });

  QUnit.test("explodeSubdomains", function (assert) {
    var fqdn = "test.what.yea.eff.org";
    var subs = utils.explodeSubdomains(fqdn);
    assert.ok(subs.length == 4);
    assert.ok(subs[0] == fqdn);
    assert.ok(subs[3] == 'eff.org');
  });

  QUnit.test("send xhrRequest", function (assert) {
    let done = assert.async();
    assert.expect(3);
    utils.xhrRequest("https://www.eff.org/files/badgertest.txt", function(err,resp){
      assert.ok(true, "xhr calls callback");
      assert.ok(err === null, "there was no error");
      assert.ok(resp === "test passed\n", "got response text");
      done();
    });
  });

  QUnit.test("send faling xhrRequest", function (assert) {
    let done = assert.async();
    assert.expect(3);
    utils.xhrRequest("https://www.eff.org/nonexistent-page", function(err/*,resp*/){
      assert.ok(true, "xhr calls callback");
      assert.ok(err, "there was an error");
      assert.ok(err.status === 404, "error was 404");
      done();
    });
  });

  QUnit.test("isPrivacyBadgerEnabled", function (assert) {
    assert.ok(badger.isPrivacyBadgerEnabled("eff.org"), "enabled for site");

    badger.disablePrivacyBadgerForOrigin("example.com");
    assert.ok(!badger.isPrivacyBadgerEnabled("example.com"), "disabled for site");
    badger.enablePrivacyBadgerForOrigin("example.com");
    assert.ok(badger.isPrivacyBadgerEnabled("example.com"), "enabled for site");
  });
  
  QUnit.test("disable/enable privacy badger for origin", function (assert) {
    var parsed = function(){ return badger.storage.getBadgerStorageObject('settings_map').getItem('disabledSites'); };
    var origLength = parsed() && parsed().length || 0;

    badger.disablePrivacyBadgerForOrigin('foo.com');
    assert.ok(parsed().length == (origLength + 1), "one more disabled site");

    badger.enablePrivacyBadgerForOrigin('foo.com');
    assert.ok(parsed().length == origLength, "one less disabled site");
  });

  QUnit.test("getRandom", function (assert) {
    var min = 1,
        max = 10,
        iterations = 1000,
        results = [];

    for(var i = 0; i < iterations; i++){
      results.push(utils.getRandom(min,max));
    }
    assert.ok(Math.max.apply(null,results) === max, "max is max");
    assert.ok(Math.min.apply(null,results) === min, "min is min");
  });

  QUnit.test("multi domain first party", function (assert) {
    assert.ok(mdfp.isMultiDomainFirstParty("dummy", "dummy"));
    assert.ok(mdfp.isMultiDomainFirstParty("google.com", "youtube.com"));
    assert.ok(!mdfp.isMultiDomainFirstParty("google.com", "nyt.com"));
  });

  QUnit.test("surrogate script URL lookups", function (assert) {
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
    let ga_js_surrogate;

    for (let i = 0; i < GA_JS_TESTS.length; i++) {
      ga_js_surrogate = getSurrogateURI(
        GA_JS_TESTS[i].url,
        'www.google-analytics.com'
      );
      assert.ok(ga_js_surrogate, GA_JS_TESTS[i].msg);
    }

    assert.ok(
      ga_js_surrogate.startsWith('data:application/javascript;base64,'),
      "The returned ga.js surrogate is a base64-encoded JavaScript data URI"
    );

    assert.ok(
      !getSurrogateURI(
        'https://a1.nyt.com/assets/homepage/20160920-111441/js/foundation/lib/framework.js',
        'a1.nyt.com'
      ),
      "New York Times script URL should not match any surrogates"
    );
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
})();
