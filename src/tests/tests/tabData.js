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
  },

  afterEach: function () {
    chrome.tabs.get = this.chromeTabsGet;
    badger.tabData.forget(this.tabId);
  }
},
function() {
  QUnit.module("logThirdParty", {
    beforeEach: function () {
      this.clock = sinon.useFakeTimers();
      sinon.stub(chrome.browserAction, "setBadgeText");
    },
    afterEach: function () {
      chrome.browserAction.setBadgeText.restore();
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, "example.com", constants.ALLOW);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 0, "count stays at zero"
    );
    assert.ok(
      chrome.browserAction.setBadgeText.notCalled,
      "updateBadge does not get called when we see a hasn't-decided-yet-to-block domain"
    );
  });

  QUnit.test("logging DNT-compliant domain", function (assert) {
    badger.logThirdParty(this.tabId, "example.com", constants.DNT);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.ALLOW);
    this.clock.tick(1);

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log the same domain, this time as blocked
    badger.logThirdParty(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
    assert.equal(
      badger.getTrackerCount(this.tabId), 1, "count gets incremented"
    );
    assert.equal(
      chrome.browserAction.setBadgeText.callCount,
      "1",
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.ALLOW);
    this.clock.tick(1);
    badger.logThirdParty(this.tabId, DOMAIN, constants.ALLOW);
    this.clock.tick(1);

    // set up domain blocking (used by getTrackerCount)
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // log blocked domain
    badger.logThirdParty(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.BLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN, constants.COOKIEBLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN1, constants.BLOCK);
    this.clock.tick(1);
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
    badger.logThirdParty(this.tabId, DOMAIN2, constants.COOKIEBLOCK);
    this.clock.tick(1);
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

    badger.disableOnSite(extractHostFromURL(this.SITE_URL));

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
    chrome.browserAction.setBadgeBackgroundColor = () => {called = true;};

    badger.updateBadge(this.tabId);

    assert.notOk(called, "setBadgeBackgroundColor does not get called");

    done();
  });

});
