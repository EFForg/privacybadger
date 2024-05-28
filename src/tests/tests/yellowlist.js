import { getBaseDomain } from "../../lib/basedomain.js";

import constants from "../../js/constants.js";
import utils from "../../js/utils.js";

function get_ylist() {
  return badger.storage.getStore('cookieblock_list').getItemClones();
}

// fake server to simulate fetch()
let stubbedFetch;

QUnit.module("Yellowlist", (hooks) => {
  hooks.before((/*assert*/) => {
    stubbedFetch = sinon.stub(globalThis, 'fetch');
  });

  hooks.after((/*assert*/) => {
    fetch.restore();
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
    stubbedFetch
      .withArgs(constants.YELLOWLIST_URL)
      .resolves(new Response(Object.keys(ylist).join("\n")));

    badger.updateYellowlist(function (err) {
      assert.notOk(err, "callback status indicates success");
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
    stubbedFetch
      .withArgs(constants.YELLOWLIST_URL)
      .resolves(new Response("", {status: 200}));

    badger.updateYellowlist(function (err) {
      assert.ok(err, "callback status indicates failure");
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
      stubbedFetch
        .withArgs(constants.YELLOWLIST_URL)
        .resolves(new Response(response, {status: 200}));

      badger.updateYellowlist(function (err) {
        assert.ok(err,
          "callback status indicates failure for " + JSON.stringify(response));
        assert.deepEqual(get_ylist(), ylist,
          "list did not get updated for " + JSON.stringify(response));
        done();
      });
    });
  });

  QUnit.test("Updating gets a server error", (assert) => {
    let done = assert.async();

    // respond with a 404 error
    stubbedFetch
      .withArgs(constants.YELLOWLIST_URL)
      .resolves(new Response("page not found", {status: 404}));

    badger.updateYellowlist(function (err) {
      assert.ok(err, "callback status indicates failure");
      if (err) {
        assert.equal(err, "Error: Failed to fetch remote yellowlist",
          "error matches expectation");
      }
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
    stubbedFetch
      .withArgs(constants.YELLOWLIST_URL)
      .resolves(new Response(Object.keys(ylist).join("\n")));

    // update yellowlist
    badger.updateYellowlist(function (err) {
      assert.notOk(err, "callback status indicates success");

      // check that the domain got cookieblocked
      assert.equal(
        badger.storage.getAction(DOMAIN),
        constants.COOKIEBLOCK,
        "domain is marked for cookieblocking"
      );

      done();
    });
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

      // similar to "parent is on yellowlist"
      // but parent is being added instead of already there
      {
        name: "Removing child while adding parent",
        domains: {
          'widgets.example.com': {
            initial: constants.BLOCK,
            add: true,
            expected: constants.COOKIEBLOCK,
            expectedBest: constants.COOKIEBLOCK
          },
          'cdn.widgets.example.com': {
            yellowlist: true,
            initial: constants.COOKIEBLOCK,
            remove: true,
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

      // similar to "child is on yellowlist"
      // but child is being added instead of already there
      {
        name: "Removing parent while adding child",
        domains: {
          'widgets.example.com': {
            yellowlist: true,
            remove: true,
            initial: constants.COOKIEBLOCK,
            expected: constants.BLOCK,
            expectedBest: constants.BLOCK
          },
          'cdn.widgets.example.com': {
            add: true,
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
        getBaseDomain("ajax.googleapis.com"),
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
          if (utils.hasOwn(data, 'expected')) {
            memo++;
          }
          if (utils.hasOwn(data, 'expectedBest')) {
            memo++;
          }
          return memo;
        }, 0));

        let ylistStorage = badger.storage.getStore('cookieblock_list');

        // set up cookieblocking
        for (let domain in test.domains) {
          let conf = test.domains[domain];
          if (conf.yellowlist) {
            ylistStorage.setItem(domain, true);
          }
          if (utils.hasOwn(conf, "initial")) {
            badger.storage.setupHeuristicAction(domain, conf.initial);
          }
        }

        // update the yellowlist
        const ylist = ylistStorage.getItemClones();
        for (let domain in test.domains) {
          if (test.domains[domain].add) {
            ylist[domain] = true;
          } else if (test.domains[domain].remove) {
            delete ylist[domain];
          }
        }
        stubbedFetch
          .withArgs(constants.YELLOWLIST_URL)
          .resolves(new Response(Object.keys(ylist).join("\n")));

        badger.updateYellowlist(err => {
          assert.notOk(err, "callback status indicates success");

          for (let domain in test.domains) {
            let expected, data = test.domains[domain];

            if (utils.hasOwn(data, 'expected')) {
              expected = data.expected;
              assert.equal(
                badger.storage.getAction(domain),
                expected,
                `action on ${domain} should be "${expected}"`
              );
            }

            if (utils.hasOwn(data, 'expectedBest')) {
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
