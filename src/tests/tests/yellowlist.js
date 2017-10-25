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

    // remove a domain
    let removed_domain = Object.keys(ylist)[0];
    delete ylist[removed_domain];

    // add a domain
    const NEW_YLIST_DOMAIN = "widgets.example.com";
    ylist[NEW_YLIST_DOMAIN] = true;

    // respond with the modified list
    server.respondWith("GET", constants.YELLOWLIST_URL,
      [200, {}, Object.keys(ylist).join("\n")]);

    badger.updateYellowlist(function (success) {
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
    server.respondWith("GET", constants.YELLOWLIST_URL,
      [200, {}, ""]);

    badger.updateYellowlist(function (success) {
      assert.notOk(success, "Callback status indicates failure");
      assert.deepEqual(get_ylist(), ylist, "List did not get updated");
      done();
    });
  });

  QUnit.test("Updating receives an invalid response", (assert) => {
    let BAD_RESPONSES = [
      "page not found",
      "page\nnot\nfound",
      "pagenotfound",
      "eff.org\n...\n",
      "...eff.org...",
      "<html><body>eff.org</body></html>",
    ];

    let done = assert.async(BAD_RESPONSES.length);
    assert.expect(1 + (2 * BAD_RESPONSES.length));

    let ylist = get_ylist();
    assert.ok(!!Object.keys(ylist).length, "Yellowlist is not empty");

    BAD_RESPONSES.forEach(response => {
      // respond with stuff that may look like the yellowlist but is not
      server.respondWith("GET", constants.YELLOWLIST_URL,
        [200, {}, response]);

      badger.updateYellowlist(function (success) {
        assert.notOk(success,
          "Callback status indicates failure for " + JSON.stringify(response));
        assert.deepEqual(get_ylist(), ylist,
          "List did not get updated for " + JSON.stringify(response));
        done();
      });
    });
  });

  QUnit.test("Updating gets a server error", (assert) => {
    let done = assert.async();
    assert.expect(1);

    // respond with a 404 error
    server.respondWith("GET", constants.YELLOWLIST_URL,
      [404, {}, "page not found"]);

    badger.updateYellowlist(function (success) {
      assert.notOk(success, "Callback status indicates failure");
      done();
    });
  });

  QUnit.test("Added domains get cookieblocked", (assert) => {
    const DOMAIN = "example.com";

    let done = assert.async();
    assert.expect(2);

    // mark domain for blocking
    badger.storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

    // respond with this domain added
    let ylist = get_ylist();
    ylist[DOMAIN] = true;
    server.respondWith("GET", constants.YELLOWLIST_URL,
      [200, {}, Object.keys(ylist).join("\n")]);

    // update yellowlist
    badger.updateYellowlist(function (success) {
      assert.ok(success, "Callback status indicates success");

      // check that the domain got cookieblocked
      assert.equal(
        badger.storage.getAction(DOMAIN),
        constants.COOKIEBLOCK,
        "domain is marked for blocking"
      );

      done();
    });
  });

  QUnit.test("Reapplying yellowlist updates", (assert) => {
    // these are all on the yellowlist
    let DOMAINS = [
      // domain, action
      ["books.google.com", null], // null means do not record
      ["clients6.google.com", ""],
      ["storage.googleapis.com", constants.BLOCK],
    ];

    // set up test data
    for (let i = 0; i < DOMAINS.length; i++) {
      let [domain, action] = DOMAINS[i];
      if (action !== null) {
        // record the domain with specified action
        badger.storage.setupHeuristicAction(domain, action);

        // block the base domain
        badger.storage.setupHeuristicAction(
          window.getBaseDomain(domain), constants.BLOCK);
      }
    }

    // (re)apply yellowlist updates
    require("migrations").Migrations.reapplyYellowlist(badger);

    // all test domains should be now set to "cookieblock"
    for (let i = 0; i < DOMAINS.length; i++) {
      let [domain,] = DOMAINS[i];
      assert.equal(
        badger.storage.getBestAction(domain),
        constants.COOKIEBLOCK,
        domain + " is cookieblocked"
      );
    }
  });

}());
