/* globals badger:false */
(function() {
  function noop () {
    Array.from(arguments).forEach(arg => {
      if (typeof arg == 'function') {
        arg();
      }
    });
  }

  function getter(name) {
    let parts = name.split('.'),
      out = window;
    parts.forEach(part => {
      out = out[part];
    });
    return out;
  }

  function setter(name, value) {
    let parts = name.split('.'),
      last = parts.pop(),
      part = window;
    parts.forEach(partName => {
      part = part[partName];
    });
    part[last] = value;
  }

  function beforeMock(names) {
    let mocked = {};
    names.forEach(name => {
      mocked[name] = getter(name);
    });
    return mocked;
  }

  function unmock(mocked) {
    Object.keys(mocked).forEach(name => {
      setter(name, mocked[name]);
    });
  }

  const DNT_COMPLIANT_DOMAIN = 'eff.org',
    POLICY_URL = chrome.extension.getURL('data/dnt-policy.txt');

  let utils = require('utils'),
    constants = require('constants');

  let clock,
    server,
    dnt_policy_txt;

  QUnit.module("DNT checks", {
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
      badger.checkedDNT = new utils.CheckedDNTBuffer();
    },

    afterEach: (/*assert*/) => {
      // reset call counts, etc. after each test
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

    badger.checkForDNTPolicy(DNT_COMPLIANT_DOMAIN, function (successStatus) {
      assert.ok(successStatus, "Domain returns good DNT policy");
      done();
    });

    badger.checkForDNTPolicy('ecorp.example', function (successStatus) {
      assert.notOk(successStatus, "Domain returns 200 but no valid policy");
      done();
    });

    // advance the clock enough to trigger all rate-limited calls
    clock.tick(constants.DNT_POLICY_CHECK_INTERVAL * NUM_TESTS);
  });

  QUnit.test("Checks are not repeated", (assert) => {
    const NUM_CHECKS = 5;
    let xhrSpy = sinon.spy(utils, "xhrRequest");

    // set recheck time to now
    badger.storage.touchDNTRecheckTime(DNT_COMPLIANT_DOMAIN, +new Date());

    for (let i = 0; i < NUM_CHECKS; i++) {
      // mirroring call signature in js/heuristicblocking.js
      badger.checkForDNTPolicy(DNT_COMPLIANT_DOMAIN);
    }

    // advance the clock
    clock.tick(constants.DNT_POLICY_CHECK_INTERVAL * NUM_CHECKS);

    assert.equal(xhrSpy.callCount, 1, "XHR method gets called exactly once");
    assert.equal(
      xhrSpy.getCall(0).args[0],
      "https://" + DNT_COMPLIANT_DOMAIN + "/.well-known/dnt-policy.txt",
      "XHR method gets called with expected DNT URL"
    );
    xhrSpy.restore();
  });

  QUnit.test("DNT checking is rate limited", (assert) => {
    const NUM_TESTS = 1;

    let done = assert.async(NUM_TESTS),
      stub = sinon.stub(utils, "xhrRequest"),
      domain = 'example.com';
    for (let i = 0; i < 5; i++) { // run 5 times
      domain = 'a' + domain;
      badger.checkForDNTPolicy(domain);
    }
    assert.equal(stub.callCount, 1); // assert xhr only called once
    stub.restore();
    badger._checkPrivacyBadgerPolicy.cancel(); // clear the queued calls
    done();
  });

  QUnit.test("DNT checking obeys user setting", (assert) => {
    const NUM_TESTS = 5;

    let done = assert.async(NUM_TESTS);
    let xhrSpy = sinon.spy(utils, "xhrRequest");
    let old_dnt_check_func = badger.isCheckingDNTPolicyEnabled;

    assert.expect(NUM_TESTS);
    badger.isCheckingDNTPolicyEnabled = () => false;

    for (let i = 0; i < NUM_TESTS; i++) {
      badger.checkForDNTPolicy(DNT_COMPLIANT_DOMAIN);
      clock.tick(constants.DNT_POLICY_CHECK_INTERVAL);
      assert.equal(xhrSpy.callCount, 0);
      done();
    }

    badger.isCheckingDNTPolicyEnabled = old_dnt_check_func;
    xhrSpy.restore();
  });

  QUnit.module("tabData", {
    beforeEach: function () {
      this.tabId = -1;
      badger.tabData[this.tabId] = {
        frames: {},
        origins: {},
        blockedCount: 0
      };
    },
  },
  function() {
    QUnit.module("logThirdPartyOriginOnTab", {
      beforeEach: function () {
        this.before = beforeMock(['badger.updateBadge']);
        badger.updateBadge = noop;
      },
      afterEach: function () {
        unmock(this.before);
      },
    });
    QUnit.test("increment blocked count", function(assert) {
      let tabId = this.tabId;
      assert.equal(badger.tabData[tabId].blockedCount, 0);

      badger.logThirdPartyOriginOnTab(tabId, 'stuff', constants.BLOCK);
      assert.equal(badger.tabData[tabId].blockedCount, 1);

      badger.logThirdPartyOriginOnTab(tabId, 'stuff', constants.BLOCK);
      assert.equal(badger.tabData[tabId].blockedCount, 1);

      badger.logThirdPartyOriginOnTab(tabId, 'eff.org', constants.COOKIEBLOCK);
      assert.equal(badger.tabData[tabId].blockedCount, 2);
    });
    QUnit.module('updateBadge', {
      beforeEach: function() {
        this.before = beforeMock([
          'chrome.tabs.get',
          'chrome.browserAction.setBadgeText',
          'chrome.browserAction.setBadgeBackgroundColor'
        ]);
      },
      afterEach: function() {
        unmock(this.before);
      },
    });
    QUnit.test("disabled", function(assert) {
      let done = assert.async(2),
        called = false;
      chrome.tabs.get = noop;
      chrome.browserAction.setBadgeText = (obj) => {
        assert.deepEqual(obj, {tabId: this.tabId, text: ''});
        done();
      };
      chrome.browserAction.setBadgeBackgroundColor = () => {called = true;};

      badger.updateBadge(this.tabId, true);
      assert.notOk(called);
      done();
    });

    QUnit.test("numblocked zero", function(assert) {
      let done = assert.async(2);
      chrome.tabs.get = noop;
      chrome.browserAction.setBadgeText = (obj) => {
        assert.deepEqual(obj, {tabId: this.tabId, text: "0"});
        done();
      };
      chrome.browserAction.setBadgeBackgroundColor = (obj) => {
        assert.deepEqual(obj, {tabId: this.tabId, color: "#00cc00"});
        done();
      };
      badger.updateBadge(this.tabId);
    });
    QUnit.test("numblocked many", function(assert) {
      let done = assert.async(2);
      badger.tabData[this.tabId].blockedCount = "many";
      chrome.tabs.get = noop;
      chrome.browserAction.setBadgeText = (obj) => {
        assert.deepEqual(obj, {tabId: this.tabId, text: "many"});
        done();
      };
      chrome.browserAction.setBadgeBackgroundColor = (obj) => {
        assert.deepEqual(obj, {tabId: this.tabId, color: "#cc0000"});
        done();
      };
      badger.updateBadge(this.tabId);
    });
  });
}());
