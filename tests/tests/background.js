/* globals badger:false */

(function() {

  const POLICY_URL = chrome.extension.getURL('doc/dnt-policy/dnt-policy.txt');

  let utils = require('utils');

  let server,
    dnt_policy_txt;

  QUnit.module("Background", {
    before: (assert) => {
      let done = assert.async();

      // fetch locally stored DNT policy
      utils.xhrRequest(POLICY_URL, function (err, data) {
        dnt_policy_txt = data;
        done();
      });
    },

    beforeEach: (/*assert*/) => {
      server = sinon.fakeServer.create();

      server.respondWith(
        "GET",
        "https://eff.org/.well-known/dnt-policy.txt",
        [200, {}, dnt_policy_txt]
      );
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

    server.respond();
  });

}());
