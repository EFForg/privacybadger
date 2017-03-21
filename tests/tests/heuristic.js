(function() {

  let hb = require('heuristicblocking');

  let chromeDetails = {
    frameId: 35,
    method: "GET",
    parentFrameId: 0,
    requestHeaders: [
      {
        name: "User-Agent",
        value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36"
      }, {
        name: "Accept",
        value: "*/*"
      }, {
        name: "Referer",
        value: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.html"
      }, {
        name: "Accept-Encoding",
        value: "gzip, deflate, sdch"
      }, {
        name: "Accept-Language",
        "value": "en-US,en;q=0.8"
      }, {
        name: "Cookie",
        value: "thirdpartytest=1234567890"
      }
    ],
    requestId: "502",
    tabId: 15,
    timeStamp: 1490117784939.147,
    type: "script",
    url: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.js"
  };

  let firefoxDetails = {
    requestId: "13",
    url: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.js",
    originUrl: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.html",
    method: "GET",
    type: "script",
    timeStamp: 1490118778473,
    frameId: 4294967303,
    parentFrameId: 0,
    tabId: 2,
    requestHeaders: [
      {
        name: "host",
        value: "eff-tracker-test.s3-website-us-west-2.amazonaws.com"
      }, {
        name: "user-agent",
        value: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:52.0) Gecko/20100101 Firefox/52.0"
      }, {
        name: "accept",
        value: "*/*"
      }, {
        name: "accept-language",
        value: "en-US,en;q=0.5"
      }, {
        name: "accept-encoding",
        value: "gzip, deflate"
      }, {
        name: "referer",
        value: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.html"
      }, {
        name: "cookie",
        value: "thirdpartytest=1234567890"
      }, {
        name: "connection",
        value: "keep-alive"
      }
    ]
  };

  QUnit.module("Heuristic", {
    before: (/*assert*/) => {
    },

    beforeEach: (/*assert*/) => {
    },

    afterEach: (/*assert*/) => {
    },

    after: (/*assert*/) => {
    }
  });

  QUnit.test("HTTP cookie tracking detection", (assert) => {
    let details = JSON.parse(JSON.stringify(chromeDetails));
    const COOKIE_INDEX = 5;

    // remove cookie header
    let cookieHeader = details.requestHeaders.splice(COOKIE_INDEX, 1);
    assert.notOk(hb.hasCookieTracking(details), "No cookie header");

    // restore it
    details.requestHeaders.push(cookieHeader[0]);
    assert.ok(hb.hasCookieTracking(details), "High-entropy cookie header");

    // set it to a low-entropy value
    details.requestHeaders[COOKIE_INDEX] = {
      name: "Cookie",
      value: "ab"
    };
    assert.notOk(hb.hasCookieTracking(details), "Low-entropy cookie header");
  });

  QUnit.test("HTTP header names are case-insensitive", (assert) => {
    assert.ok(
      hb.hasCookieTracking(chromeDetails),
      "Cookie tracking detected with capitalized (Chrome) headers"
    );
    assert.ok(
      hb.hasCookieTracking(firefoxDetails),
      "Cookie tracking detected with lowercase (Firefox) headers"
    );
  });

}());
