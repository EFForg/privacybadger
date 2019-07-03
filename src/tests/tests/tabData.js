/* globals badger:false */

(function () {

let constants = require('constants');

QUnit.module("tabData", {
  beforeEach: function () {

    this.SITE_URL = "http://example.com/";
    this.tabId = 9999;

    badger.recordFrame(this.tabId, 0, this.SITE_URL);

    // stub chrome.tabs.get manually as we have some sort of issue stubbing with Sinon in Firefox
    this.chromeTabsGet = chrome.tabs.get;
    chrome.tabs.get = (tab_id, callback) => {
      return callback({
        active: true
      });
    };
  },

  afterEach: function () {
    chrome.tabs.get = this.chromeTabsGet;
    delete badger.tabData[this.tabId];
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
      badger.getTrackerCount(this.tabId), 0, "count starts at zero"
    );

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log blocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
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
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.ok(
      chrome.browserAction.setBadgeText.calledOnce,
      "updateBadge gets called when we see an unblocked domain"
    );
    assert.ok(chrome.browserAction.setBadgeText.calledWithExactly({
      tabId: this.tabId,
      text: "1"
    }), "setBadgeText was called with expected args");
  });

  QUnit.test("logging DNT-compliant domain", function (assert) {
    badger.logThirdPartyOriginOnTab(this.tabId, "example.com", constants.DNT);
    assert.equal(
      badger.getTrackerCount(this.tabId), 0, "count stays at zero"
    );
    assert.ok(
      chrome.browserAction.setBadgeText.notCalled,
      "updateBadge does not get called when we see a DNT-compliant domain"
    );
  });

  QUnit.test("logging as unblocked then as blocked", function (assert) {
    const DOMAIN = "example.com";

    // log unblocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log the same domain, this time as blocked
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
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

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log blocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
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
      badger.getTrackerCount(this.tabId),
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

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log blocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
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
      badger.getTrackerCount(this.tabId),
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

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.COOKIEBLOCK);

    // log cookieblocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.COOKIEBLOCK);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
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

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN1, constants.BLOCK);
    badger.storage.setupHeuristicAction(DOMAIN2, constants.COOKIEBLOCK);

    // log blocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN1, constants.BLOCK);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
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
      badger.getTrackerCount(this.tabId), 2, "count gets incremented again"
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
