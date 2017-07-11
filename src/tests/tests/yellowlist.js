/* globals badger:false */

(function() {

  function get_ylist() {
    return badger.storage.getBadgerStorageObject(
      'cookieblock_list').getItemClones();
  }

  let constants = require('constants');

  // fake server to simulate XMLHttpRequests
  let server;

  QUnit.module("Yellowlist", {
    before: (/*assert*/) => {
      server = sinon.fakeServer.create({
        respondImmediately: true
      });
    },

    after: (/*assert*/) => {
      server.restore();
    }
  });

  QUnit.test("Updating to a valid list", (assert) => {
    let done = assert.async();
    assert.expect(3);

    let ylist = get_ylist();
    assert.ok(!!Object.keys(ylist).length, "Yellowlist is not empty");

    // add the new domain
    const NEW_YLIST_DOMAIN = "widgets.example.com";
    ylist[NEW_YLIST_DOMAIN] = true;

    // respond with current list plus new domain
    server.respondWith("GET", constants.COOKIE_BLOCK_LIST_URL,
      [200, {}, Object.keys(ylist).join("\n")]);

    badger.updateCookieBlockList(function (success) {
      assert.ok(success, "Callback status indicates success");
      assert.deepEqual(get_ylist(), ylist, "List got updated");
      done();
    });
  });

  QUnit.test("Updating receives a blank response", (assert) => {
    let done = assert.async();
    assert.expect(3);

    let ylist = get_ylist();
    assert.ok(!!Object.keys(ylist).length, "Yellowlist is not empty");

    // respond with no content
    server.respondWith("GET", constants.COOKIE_BLOCK_LIST_URL,
      [200, {}, ""]);

    badger.updateCookieBlockList(function (success) {
      assert.notOk(success, "Callback status indicates failure");
      assert.deepEqual(get_ylist(), ylist, "List did not get updated");
      done();
    });
  });

  QUnit.test("Updating receives an invalid response", (assert) => {
    let done = assert.async();
    assert.expect(3);

    let ylist = get_ylist();
    assert.ok(!!Object.keys(ylist).length, "Yellowlist is not empty");

    // respond with some random text
    server.respondWith("GET", constants.COOKIE_BLOCK_LIST_URL,
      [200, {}, "page not found"]);

    badger.updateCookieBlockList(function (success) {
      assert.notOk(success, "Callback status indicates failure");
      assert.deepEqual(get_ylist(), ylist, "List did not get updated");
      done();
    });
  });

  QUnit.test("Updating gets a server error", (assert) => {
    let done = assert.async();
    assert.expect(1);

    // respond with a 404 error
    server.respondWith("GET", constants.COOKIE_BLOCK_LIST_URL,
      [404, {}, "page not found"]);

    badger.updateCookieBlockList(function (success) {
      assert.notOk(success, "Callback status indicates failure");
      done();
    });
  });

}());
