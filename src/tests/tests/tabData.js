import { extractHostFromURL } from "../../lib/basedomain.js";

import constants from "../../js/constants.js";

QUnit.module("tabData", {
  beforeEach: function () {

    this.SITE_URL = "http://example.com/";
    this.tabId = 9999;

    badger.tabData.recordFrame(this.tabId, 0, this.SITE_URL);

    // stub chrome.tabs.get manually as we have some sort of issue stubbing with Sinon in Firefox
    this.chromeTabsGet = chrome.tabs.get;
    chrome.tabs.get = (tab_id, callback) => {
      return callback({
        active: true
      });
    };

    // another Firefox workaround: setBadgeText gets stubbed fine but setBadgeBackgroundColor doesn't
    this.setBadgeBackgroundColor = chrome.action.setBadgeBackgroundColor;
    chrome.action.setBadgeBackgroundColor = () => {};
  },

  afterEach: function () {
    chrome.action.setBadgeBackgroundColor = this.setBadgeBackgroundColor;
    chrome.tabs.get = this.chromeTabsGet;
    badger.tabData.forget(this.tabId);
  }
},
function() {
  QUnit.module("logThirdPartyOriginOnTab", {
    beforeEach: function () {
      this.clock = sinon.useFakeTimers();
      sinon.stub(chrome.action, "setBadgeText");
    },
    afterEach: function () {
      chrome.action.setBadgeText.restore();
      this.clock.restore();
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
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge gets called when we see a blocked domain"
    );
    assert.ok(chrome.action.setBadgeText.calledWithExactly({
      tabId: this.tabId,
      text: "1"
    }), "setBadgeText was called with expected args");
  });

  QUnit.test("logging unblocked domain", function (assert) {
    badger.logThirdPartyOriginOnTab(this.tabId, "example.com", constants.ALLOW);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 0, "count stays at zero"
    );
    assert.ok(
      chrome.action.setBadgeText.notCalled,
      "updateBadge does not get called when we see a hasn't-decided-yet-to-block domain"
    );
  });

  QUnit.test("logging DNT-compliant domain", function (assert) {
    badger.logThirdPartyOriginOnTab(this.tabId, "example.com", constants.DNT);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 0, "count stays at zero"
    );
    assert.ok(
      chrome.action.setBadgeText.notCalled,
      "updateBadge does not get called when we see a DNT-compliant domain"
    );
  });

  QUnit.test("logging as unblocked then as blocked", function (assert) {
    const DOMAIN = "example.com";

    // log unblocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);
    this.clock.tick(1);

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log the same domain, this time as blocked
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.equal(
      chrome.action.setBadgeText.callCount,
      "1",
      "updateBadge gets called when we see a blocked domain"
    );
    assert.ok(chrome.action.setBadgeText.calledWithExactly({
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
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge gets called when we see a blocked domain"
    );
    assert.ok(chrome.action.setBadgeText.calledWithExactly({
      tabId: this.tabId,
      text: "1"
    }), "setBadgeText was called with expected args");

    // log the same blocked domain again
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId),
      1,
      "count does not get incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge not called when we see the same blocked domain again"
    );
  });

  QUnit.test("logging 2x unblocked then 2x blocked", function (assert) {
    const DOMAIN = "example.com";

    // log unblocked domain twice
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);
    this.clock.tick(1);
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.ALLOW);
    this.clock.tick(1);

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log blocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge gets called when we see a blocked domain"
    );
    assert.deepEqual(chrome.action.setBadgeText.getCall(0).args[0], {
      tabId: this.tabId,
      text: "1"
    }, "setBadgeText was called with expected args");

    // log the same blocked domain again
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId),
      1,
      "count does not get incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge not called when we see the same blocked domain again"
    );
  });

  QUnit.test("logging cookieblocked domain", function (assert) {
    const DOMAIN = "example.com";

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.COOKIEBLOCK);

    // log cookieblocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN, constants.COOKIEBLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge gets called when we see a cookieblocked domain"
    );
    assert.ok(chrome.action.setBadgeText.calledWithExactly({
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
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.ok(
      chrome.action.setBadgeText.calledOnce,
      "updateBadge gets called when we see a blocked domain"
    );
    assert.ok(chrome.action.setBadgeText.calledWithExactly({
      tabId: this.tabId,
      text: "1"
    }), "setBadgeText was called with expected args");

    // log cookieblocked domain
    badger.logThirdPartyOriginOnTab(this.tabId, DOMAIN2, constants.COOKIEBLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 2, "count gets incremented again"
    );
    assert.ok(
      chrome.action.setBadgeText.calledTwice,
      "updateBadge gets called when we see a cookieblocked domain"
    );
    assert.ok(chrome.action.setBadgeText.calledWithExactly({
      tabId: this.tabId,
      text: "2"
    }), "setBadgeText was called with expected args");
  });

  QUnit.module('updateBadge', {
    beforeEach: function() {
      this.setBadgeText = sinon.stub(chrome.action, "setBadgeText");
    },
    afterEach: function() {
      this.setBadgeText.restore();
    },
  });

  QUnit.test("disabled", function(assert) {
    let done = assert.async(2),
      called = false;

    badger.disableOnSite(extractHostFromURL(this.SITE_URL));

    this.setBadgeText.callsFake((obj) => {
      assert.deepEqual(obj, {tabId: this.tabId, text: ''});
      done();
    });
    chrome.action.setBadgeBackgroundColor = () => {called = true;};

    badger.updateBadge(this.tabId);

    assert.notOk(called, "setBadgeBackgroundColor does not get called");

    done();
  });

  QUnit.test("numblocked zero", function(assert) {
    let done = assert.async(2),
      called = false;

    this.setBadgeText.callsFake((obj) => {
      assert.deepEqual(
        obj,
        {tabId: this.tabId, text: ""},
        "setBadgeText called with expected args"
      );
      done();
    });
    chrome.action.setBadgeBackgroundColor = () => {called = true;};

    badger.updateBadge(this.tabId);

    assert.notOk(called, "setBadgeBackgroundColor does not get called");

    done();
  });

});
