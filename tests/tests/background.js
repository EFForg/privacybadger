/* globals badger:false */

(function() {

  const DNT_COMPLIANT_DOMAIN = 'eff.org',
    POLICY_URL = chrome.extension.getURL('data/dnt-policy.txt');

  let utils = require('utils'),
    constants = require('constants');

  let clock,
    server,
    xhrSpy,
    dnt_policy_txt;

  QUnit.module("Background", {
    before: (assert) => {
      let done = assert.async();

      // fetch locally stored DNT policy
      utils.xhrRequest(POLICY_URL, function (err, data) {
        dnt_policy_txt = data;

        // disable recheckDNTPolicyForDomains
        // to prevent it from messing with tests below
        sinon.stub(badger, "recheckDNTPolicyForDomains");
        // clear out any domains waiting to be checked
        badger._checkPrivacyBadgerPolicy.cancel();

        // set up fake server to simulate XMLHttpRequests
        server = sinon.fakeServer.create({
          respondImmediately: true
        });
        server.respondWith(
          "GET",
          "https://eff.org/.well-known/dnt-policy.txt",
          [200, {}, dnt_policy_txt]
        );

        // set up fake timers to simulate window.setTimeout and co.
        clock = sinon.useFakeTimers(+new Date());

        done();
      });
    },

    beforeEach: (/*assert*/) => {
      // spy on utils.xhrRequest
      xhrSpy = sinon.spy(utils, "xhrRequest");
    },

    afterEach: (/*assert*/) => {
      // reset call counts, etc. after each test
      utils.xhrRequest.restore();
    },

    after: (/*assert*/) => {
      clock.restore();
      server.restore();
      badger.recheckDNTPolicyForDomains.restore();
    }
  });

  QUnit.test("DNT policy checking", (assert) => {
    const NUM_TESTS = 2,
      done = assert.async(NUM_TESTS);

    assert.expect(NUM_TESTS);

    badger.checkForDNTPolicy(DNT_COMPLIANT_DOMAIN, 0, function (successStatus) {
      assert.ok(successStatus, "Domain returns good DNT policy");
      done();
    });

    badger.checkForDNTPolicy('ecorp.example', 0, function (successStatus) {
      assert.notOk(successStatus, "Domain returns 200 but no valid policy");
      done();
    });

    // advance the clock enough to trigger all rate-limited calls
    clock.tick(constants.DNT_POLICY_CHECK_INTERVAL * NUM_TESTS);
  });

  QUnit.test("Several checks for same domain resolve to one XHR", (assert) => {
    const NUM_CHECKS = 5;

    // set recheck time to now
    badger.storage.touchDNTRecheckTime(DNT_COMPLIANT_DOMAIN, +new Date());

    for (let i = 0; i < NUM_CHECKS; i++) {
      // mirroring call signature in src/heuristicblocking.js
      badger.checkForDNTPolicy(
        DNT_COMPLIANT_DOMAIN,
        badger.storage.getNextUpdateForDomain(DNT_COMPLIANT_DOMAIN)
      );
    }

    // advance the clock
    clock.tick(constants.DNT_POLICY_CHECK_INTERVAL * NUM_CHECKS);

    assert.equal(xhrSpy.callCount, 1, "XHR method gets called exactly once");
    assert.equal(
      xhrSpy.getCall(0).args[0],
      "https://" + DNT_COMPLIANT_DOMAIN + "/.well-known/dnt-policy.txt",
      "XHR method gets called with expected DNT URL"
    );
  });

  QUnit.test("DNT checking is rate limited", (assert) => {
    const NUM_TESTS = 5;

    let done = assert.async(NUM_TESTS);

    assert.expect(NUM_TESTS);

    for (let i = 0; i < NUM_TESTS; i++) {
      badger.checkForDNTPolicy(
        DNT_COMPLIANT_DOMAIN,
        0,
        function () { // eslint-disable-line no-loop-func
          assert.equal(xhrSpy.callCount, i+1);
          clock.tick(constants.DNT_POLICY_CHECK_INTERVAL);
          done();
        }
      );
    }
  });

}());
