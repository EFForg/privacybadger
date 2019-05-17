(function () {

let hb = require('heuristicblocking');

let chromeDetails = {
  frameId: 35,
  method: "GET",
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
      value: "en-US,en;q=0.8"
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
const CHROME_COOKIE_INDEX = chromeDetails.requestHeaders.findIndex(
  i => i.name == "Cookie"
);

let firefoxDetails = {
  requestId: "13",
  url: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.js",
  originUrl: "http://eff-tracker-test.s3-website-us-west-2.amazonaws.com/third-party.html",
  method: "GET",
  type: "script",
  timeStamp: 1490118778473,
  frameId: 4294967303,
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

  // remove cookie header
  let cookieHeader = details.requestHeaders.splice(CHROME_COOKIE_INDEX, 1);
  assert.notOk(hb.hasCookieTracking(details), "No cookie header");

  // restore it
  details.requestHeaders.push(cookieHeader[0]);
  assert.ok(hb.hasCookieTracking(details), "High-entropy cookie header");

  // set it to a low-entropy value
  details.requestHeaders[CHROME_COOKIE_INDEX] = {
    name: "Cookie",
    value: "key=ab"
  };
  assert.notOk(hb.hasCookieTracking(details), "Low-entropy cookie header");

  // check when individual entropy is low but overall entropy is over threshold
  // add another low entropy cookie
  details.requestHeaders.push({
    name: "Cookie",
    value: "key=ab"
  });
  assert.ok(hb.hasCookieTracking(details),
    "Two low-entropy cookies combine to cross tracking threshold");
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

QUnit.test("Cookie attributes shouldn't add to entropy", (assert) => {
  let ATTR_COOKIES = [
    'test-cookie=true; Expires=Thu, 01-Jan-1970 00:00:01 GMT; Path=/; Domain=.parrable.com',
    '__usd_latimes.com=; expires=Wed, 03-May-2017 01:20:20 GMT; domain=.go.sonobi.com; path=/',
    'ses55=; Domain=.rubiconproject.com; Path=/; Expires=Wed, 03-May-2017 11:59:59 GMT; Max-Age=38407',
    'vf=5;Version=1;Comment=;Domain=.contextweb.com;Path=/;Max-Age=9583',
    'PUBMDCID=2; domain=pubmatic.com; expires=Tue, 01-Aug-2017 01:20:21 GMT; path=/',
    'tc=; path=/; Max-Age=31536000; expires=Thu, 03 May 2018 01:20:21 GMT',
    'uid=; path=/; expires=Wed, 03 May 2017 01:20:31 GMT; domain=medium.com; secure; httponly',
  ];

  let details = JSON.parse(JSON.stringify(chromeDetails));
  for (let i = 0; i < ATTR_COOKIES.length; i++) {
    details.requestHeaders[CHROME_COOKIE_INDEX].value = ATTR_COOKIES[i];
    assert.notOk(hb.hasCookieTracking(details),
      "cookie attributes test #" + i);
  }
});

QUnit.test("CloudFlare cookies should get ignored", (assert) => {
  let CLOUDFLARE_COOKIES = [
    '__cfduid=d3c728f97e01b1ab6969828f24b42ab111493693758',
    '__cfduid=d9758e8613dd4acbba3248dde15e74f8d1493774432; expires=Thu, 03-May-18 01:20:32 GMT; path=/; domain=.medium.com; HttpOnly',
    '__cfduid=de8a1734f91060dba20e2833705018b911493771353; expires=Thu, 03-May-18 02:25:53 GMT; path=/; domain=.fightforthefuture.org; HttpOnly',
  ];

  let details = JSON.parse(JSON.stringify(chromeDetails));
  for (let i = 0; i < CLOUDFLARE_COOKIES.length; i++) {
    details.requestHeaders[CHROME_COOKIE_INDEX].value = CLOUDFLARE_COOKIES[i];
    assert.notOk(hb.hasCookieTracking(details),
      "CloudFlare cookie test #" + i);
  }
});

}());
