/* globals badger:false */

(function () {

function get_ylist() {
  return badger.storage.getBadgerStorageObject(
    'cookieblock_list').getItemClones();
}

let constants = require('constants');

// fake server to simulate XMLHttpRequests
let server;

QUnit.module("Yellowlist", (hooks) => {
  hooks.before((/*assert*/) => {
    server = sinon.fakeServer.create({
      respondImmediately: true
    });
  });

  hooks.after((/*assert*/) => {
    server.restore();
  });

  QUnit.test("Updating to a valid list", (assert) => {
    let done = assert.async();
    assert.expect(3);

    let ylist = get_ylist();
    assert.ok(!!Object.keys(ylist).length, "yellowlist is not empty");

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
      assert.ok(success, "callback status indicates success");
      assert.deepEqual(get_ylist(), ylist, "list got updated");
      done();
    });
  });

  QUnit.test("Updating receives a blank response", (assert) => {
    let done = assert.async();
    assert.expect(3);

    let ylist = get_ylist();
    assert.ok(!!Object.keys(ylist).length, "yellowlist is not empty");

    // respond with no content
    server.respondWith("GET", constants.YELLOWLIST_URL,
      [200, {}, ""]);

    badger.updateYellowlist(function (success) {
      assert.notOk(success, "callback status indicates failure");
      assert.deepEqual(get_ylist(), ylist, "list did not get updated");
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
    assert.ok(!!Object.keys(ylist).length, "yellowlist is not empty");

    BAD_RESPONSES.forEach(response => {
      // respond with stuff that may look like the yellowlist but is not
      server.respondWith("GET", constants.YELLOWLIST_URL,
        [200, {}, response]);

      badger.updateYellowlist(function (success) {
        assert.notOk(success,
          "callback status indicates failure for " + JSON.stringify(response));
        assert.deepEqual(get_ylist(), ylist,
          "list did not get updated for " + JSON.stringify(response));
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
      assert.notOk(success, "callback status indicates failure");
      done();
    });
  });

  QUnit.test("added domains get cookieblocked", (assert) => {
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
      assert.ok(success, "callback status indicates success");

      // check that the domain got cookieblocked
      assert.equal(
        badger.storage.getAction(DOMAIN),
        constants.COOKIEBLOCK,
        "domain is marked for cookieblocking"
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

  QUnit.module("Removing domains", () => {
    let TESTS = [
      {
        name: "Basic scenario",
        domains: {
          'example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
        }
      },

      {
        name: "Parent is on yellowlist",
        domains: {
          'widgets.example.com': {
            yellowlist: true,
            initial: constants.COOKIEBLOCK
          },
          'cdn.widgets.example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.COOKIEBLOCK,
            expectedBest: constants.COOKIEBLOCK
          },
        }
      },

      // scenario from https://github.com/EFForg/privacybadger/issues/1474
      {
        name: "Parent is on yellowlist and is a PSL TLD (not in action map)",
        domains: {
          'googleapis.com': {
            yellowlist: true,
            expected: constants.NO_TRACKING,
            expectedBest: constants.NO_TRACKING,
          },
          'ajax.googleapis.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.COOKIEBLOCK,
            expectedBest: constants.COOKIEBLOCK
          },
        }
      },

      {
        name: "Child is on yellowlist",
        domains: {
          'widgets.example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
          'cdn.widgets.example.com': {
            yellowlist: true,
            expected: constants.COOKIEBLOCK,
            expectedBest: constants.COOKIEBLOCK
          },
        }
      },

      {
        name: "Removing parent blocks subdomains",
        domains: {
          // parent domain is yellowlisted and cookieblocked
          'example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
          // non-yellowlisted subdomain
          'cdn1.example.com': {
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
          // another non-yellowlisted subdomain
          'cdn2.example.com': {
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
        }
      },

      {
        name: "Parent is blocked",
        domains: {
          'example.com': {
            initial: constants.BLOCK,
          },
          // removing from yellowlist will get this blocked
          'www.example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
          // removing from yellowlist will get this blocked
          's-static.ak.example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
          // yellowlisted and cookieblocked, should stay the same
          'video.example.com': {
            yellowlist: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.COOKIEBLOCK,
            expectedBest: constants.COOKIEBLOCK
          },
          // non-tracking, should stay the same
          'ampcid.example.com': {
            initial: "",
            expected: constants.NO_TRACKING,
            expectedBest: constants.BLOCK
          },
        }
      },

      // scenario from https://github.com/EFForg/privacybadger/issues/1474:
      // using endsWith() and removing "" blocked all domains in action map
      // that were also on the yellowlist, regardless of their status
      {
        name: "Removing blank domain does not block entire yellowlist",
        domains: {
          '': {
            yellowlist: true,
            remove: true
          },
          // on yellowlist and in action map as non-tracking
          'avatars0.example.com': {
            yellowlist: true,
            initial: "",
            expected: constants.NO_TRACKING,
            expectedBest: constants.NO_TRACKING
          },
          // on yellowlist and in action map but not yet blocked
          'api.example.net': {
            yellowlist: true,
            initial: constants.ALLOW,
            expected: constants.ALLOW,
            expectedBest: constants.ALLOW
          }
        }
      }
    ];

    QUnit.test("googleapis.com is still a PSL TLD", (assert) => {
      assert.notEqual(
        window.getBaseDomain("ajax.googleapis.com"),
        "googleapis.com",
        "PSL yellowlist test depends on googleapis.com remaining a PSL TLD"
      );
    });

    TESTS.forEach(test => {
      QUnit.test(test.name, (assert) => {

        let done = assert.async();

        // to get num. of assertions, tally the expected/expectedBest props,
        // and add one for the yellowlist update assertion
        assert.expect(1 + Object.keys(test.domains).reduce((memo, domain) => {
          let data = test.domains[domain];
          if (data.hasOwnProperty('expected')) {
            memo++;
          }
          if (data.hasOwnProperty('expectedBest')) {
            memo++;
          }
          return memo;
        }, 0));

        let ylistStorage = badger.storage.getBadgerStorageObject('cookieblock_list');

        // set up cookieblocking
        for (let domain in test.domains) {
          let conf = test.domains[domain];
          if (conf.yellowlist) {
            ylistStorage.setItem(domain, true);
          }
          if (conf.hasOwnProperty("initial")) {
            badger.storage.setupHeuristicAction(domain, conf.initial);
          }
        }

        // update the yellowlist making sure removed domains aren't on it
        const ylist = ylistStorage.getItemClones();
        for (let domain in test.domains) {
          if (test.domains[domain].remove) {
            delete ylist[domain];
          }
        }
        server.respondWith("GET", constants.YELLOWLIST_URL,
          [200, {}, Object.keys(ylist).join("\n")]);

        badger.updateYellowlist(success => {
          assert.ok(success, "callback status indicates success");

          for (let domain in test.domains) {
            let expected, data = test.domains[domain];

            if (data.hasOwnProperty('expected')) {
              expected = data.expected;
              assert.equal(
                badger.storage.getAction(domain),
                expected,
                `action on ${domain} should be "${expected}"`
              );
            }

            if (data.hasOwnProperty('expectedBest')) {
              expected = data.expectedBest;
              assert.equal(
                badger.storage.getBestAction(domain),
                expected,
                `best action for ${domain} should be "${expected}"`
              );
            }
          }

          done();
        });

      });
    });
  });

});

}());
