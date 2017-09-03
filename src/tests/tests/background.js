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
      // mirroring call signature in js/heuristicblocking.js
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

  QUnit.test("DNT checking obeys user setting", (assert) => {
    const NUM_TESTS = 5;

    let done = assert.async(NUM_TESTS);
    let old_dnt_check_func = badger.isCheckingDNTPolicyEnabled;

    assert.expect(NUM_TESTS);
    badger.isCheckingDNTPolicyEnabled = () => false;

    for (let i = 0; i < NUM_TESTS; i++) {
      badger.checkForDNTPolicy(
        DNT_COMPLIANT_DOMAIN,
        0);
      clock.tick(constants.DNT_POLICY_CHECK_INTERVAL);
      assert.equal(xhrSpy.callCount, 0);
      done();
    }

    badger.isCheckingDNTPolicyEnabled = old_dnt_check_func;
  });

  QUnit.module("tabData", {
    beforeEach: function () {

      this.SITE_URL = "http://example.com/";
      this.tabId = -1;

      badger.tabData[this.tabId] = {
        frames: {},
        origins: {}
      };

      // stub chrome.tabs.get manually as we have some sort of issue stubbing with Sinon in Firefox
      this.chromeTabsGet = chrome.tabs.get;
      chrome.tabs.get = (tab_id, callback) => {
        return callback({
          active: true,
          url: this.SITE_URL
        });
      };
    },

    afterEach: function () {
      chrome.tabs.get = this.chromeTabsGet;
    }
  },
  function() {
    QUnit.module("logThirdPartyOriginOnTab", {
      beforeEach: function () {
        sinon.stub(chrome.browserAction, "setBadgeText");
      },
      afterEach: function () {
        chrome.browserAction.setBadgeText.restore();
      },
    });

    QUnit.test("logging blocked domain", function (assert) {
      const DOMAIN = "example.com";

      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 0, "count starts at zero"
      );

      // set up domain blocking (used by getBlockedOriginCount)
      badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

      // log blocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 1, "count gets incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge gets called when we see a blocked domain"
      );
      assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
        tabId: this.tabId,
        text: "1"
      }), "setBadgeText was called with expected args");
    });

    QUnit.test("logging unblocked domain", function (assert) {
      badger.logThirdPartyOriginOnTab(this.tabId, "example.com", constants.ALLOW);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 0, "count stays at zero"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.notCalled,
        "updateBadge does not get called when we see an unblocked domain"
      );
    });

    QUnit.test("logging as unblocked then as blocked", function (assert) {
      const DOMAIN = "example.com";

      // log unblocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);

      // set up domain blocking (used by getBlockedOriginCount)
      badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

      // log the same domain, this time as blocked
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 1, "count gets incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge gets called when we see a blocked domain"
      );
      assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
        tabId: this.tabId,
        text: "1"
      }), "setBadgeText was called with expected args");
    });

    QUnit.test("logging blocked domain twice", function (assert) {
      const DOMAIN = "example.com";

      // set up domain blocking (used by getBlockedOriginCount)
      badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

      // log blocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 1, "count gets incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge gets called when we see a blocked domain"
      );
      assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
        tabId: this.tabId,
        text: "1"
      }), "setBadgeText was called with expected args");

      // log the same blocked domain again
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId),
        1,
        "count does not get incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge not called when we see the same blocked domain again"
      );
    });

    QUnit.test("logging 2x unblocked then 2x blocked", function (assert) {
      const DOMAIN = "example.com";

      // log unblocked domain twice
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);

      // set up domain blocking (used by getBlockedOriginCount)
      badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

      // log blocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 1, "count gets incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge gets called when we see a blocked domain"
      );
      assert.deepEqual(chrome.browserAction.setBadgeText.getCall(0).args[0], {
        tabId: this.tabId,
        text: "1"
      }, "setBadgeText was called with expected args");

      // log the same blocked domain again
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId),
        1,
        "count does not get incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge not called when we see the same blocked domain again"
      );
    });

    QUnit.test("logging cookieblocked domain", function (assert) {
      const DOMAIN = "example.com";

      // set up domain blocking (used by getBlockedOriginCount)
      badger.storage.setupHeuristicAction(DOMAIN, constants.COOKIEBLOCK);

      // log cookieblocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.COOKIEBLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 1, "count gets incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge gets called when we see a cookieblocked domain"
      );
      assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
        tabId: this.tabId,
        text: "1"
      }), "setBadgeText was called with expected args");
    });

    QUnit.test("logging several domains", function (assert) {
      const DOMAIN1 = "example.com",
        DOMAIN2 = "example.net";

      // set up domain blocking (used by getBlockedOriginCount)
      badger.storage.setupHeuristicAction(DOMAIN1, constants.BLOCK);
      badger.storage.setupHeuristicAction(DOMAIN2, constants.COOKIEBLOCK);

      // log blocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN1, constants.BLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 1, "count gets incremented"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledOnce,
        "updateBadge gets called when we see a blocked domain"
      );
      assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
        tabId: this.tabId,
        text: "1"
      }), "setBadgeText was called with expected args");

      // log cookieblocked domain
      badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN2, constants.COOKIEBLOCK);
      assert.equal(
        badger.getBlockedOriginCount(this.tabId), 2, "count gets incremented again"
      );
      assert.ok(
        chrome.browserAction.setBadgeText.calledTwice,
        "updateBadge gets called when we see a cookieblocked domain"
      );
      assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
        tabId: this.tabId,
        text: "2"
      }), "setBadgeText was called with expected args");
    });

    QUnit.module('updateBadge', {
      beforeEach: function() {
        this.setBadgeText = sinon.stub(chrome.browserAction, "setBadgeText");

        // another Firefox workaround: setBadgeText gets stubbed fine but setBadgeBackgroundColor doesn't
        this.setBadgeBackgroundColor = chrome.browserAction.setBadgeBackgroundColor;
      },
      afterEach: function() {
        this.setBadgeText.restore();
        chrome.browserAction.setBadgeBackgroundColor = this.setBadgeBackgroundColor;
      },
    });

    QUnit.test("disabled", function(assert) {
      let done = assert.async(2),
        called = false;

      badger.disablePrivacyBadgerForOrigin(window.extractHostFromURL(this.SITE_URL));

      this.setBadgeText.callsFake((obj) => {
        assert.deepEqual(obj, {tabId: this.tabId, text: ''});
        done();
      });
      chrome.browserAction.setBadgeBackgroundColor = () => {called = true;};

      badger.updateBadge(this.tabId);

      assert.notOk(called, "setBadgeBackgroundColor does not get called");

      done();
    });

    QUnit.test("numblocked zero", function(assert) {
      let done = assert.async(2);

      this.setBadgeText.callsFake((obj) => {
        assert.deepEqual(
          obj,
          {tabId: this.tabId, text: "0"},
          "setBadgeText called with expected args"
        );
        done();
      });
      chrome.browserAction.setBadgeBackgroundColor = (obj) => {
        assert.deepEqual(
          obj,
          {tabId: this.tabId, color: "#00cc00"},
          "setBadgeBackgroundColor called with expected args"
        );
        done();
      };

      badger.updateBadge(this.tabId);
    });

  });
}());
