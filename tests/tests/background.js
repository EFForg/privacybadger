/* globals badger:false */

(function() {

  const POLICY_URL = chrome.extension.getURL('doc/dnt-policy/dnt-policy.txt');

  let utils = require('utils');

  let server;

  QUnit.module("Background", {
    beforeEach: (/*assert*/) => {
      server = sinon.fakeServer.create();
    },
    afterEach: (/*assert*/) => {
      server.restore();
    }
  });

  QUnit.test("DNT policy checking works", (assert) => {
    let done = assert.async();
    assert.expect(1);

    badger.checkForDNTPolicy('eff.org', 0, function (successStatus) {
      assert.ok(successStatus, "eff.org has a good DNT policy");
      done();
    });

    // need to let XHR to fetch DNT policy go through for real
    server.xhr.useFilters = true;
    server.xhr.addFilter(function (method, url) {
      return url == POLICY_URL;
    });
    // fetch locally stored DNT policy
    utils.xhrRequest(POLICY_URL, function (err, dnt_policy) {
      // respond from fake server
      server.requests[0].respond(200, {}, dnt_policy);
    });
  });

}());
