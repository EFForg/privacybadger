/* globals badger:false */
(function() {

  QUnit.module("Background");

  QUnit.test("DNT policy checking works", (assert) => {
    let done = assert.async();
    assert.expect(1);

    badger.checkForDNTPolicy('eff.org', 0, function (successStatus) {
      assert.ok(successStatus, "eff.org has a good DNT policy");
      done();
    });
  });

}());
