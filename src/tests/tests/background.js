import constants from "../../js/constants.js";
import mdfp from "../../js/multiDomainFirstParties.js";
import utils from "../../js/utils.js";

const DNT_COMPLIANT_DOMAIN = 'www.eff.org',
  DNT_DOMAINS = [
    DNT_COMPLIANT_DOMAIN,
    'dnt2.example',
    'dnt3.example',
    'dnt4.example',
    'dnt5.example',
  ],
  POLICY_URL = chrome.runtime.getURL('data/dnt-policy.txt');

let clock,
  stubbedFetch,
  xhrSpy,
  dnt_policy_txt;

function setupBadgerStorage(badger) {
  // add foo.com, allowed as seen tracking on only one site
  badger.storage.action_map.setItem('foo.com', {
    dnt: false,
    heuristicAction: constants.ALLOW,
    nextUpdateTime: 100,
    userAction: ""
  });
  badger.storage.snitch_map.setItem('foo.com', ['a.co']);

  // add sub.bar.com,
  // blocked after having been recorded tracking on three sites
  badger.storage.action_map.setItem('bar.com', {
    dnt: false,
    heuristicAction: constants.BLOCK,
    nextUpdateTime: 100,
    userAction: ""
  });
  badger.storage.action_map.setItem('sub.bar.com', {
    dnt: false,
    heuristicAction: constants.BLOCK,
    nextUpdateTime: 100,
    userAction: ""
  });
  badger.storage.snitch_map.setItem('bar.com', ['a.co', 'b.co', 'c.co']);
}

QUnit.module("Background", {
  before: (assert) => {
    let done = assert.async();

    // fetch locally stored DNT policy
    utils.fetchResource(POLICY_URL, function (_, data) {
      dnt_policy_txt = data;

      // set up fake server to simulate fetch()
      stubbedFetch = sinon.stub(globalThis, 'fetch');
      DNT_DOMAINS.forEach(domain => {
        stubbedFetch
          .withArgs("https://" + domain + "/.well-known/dnt-policy.txt")
          .resolves(new Response(dnt_policy_txt));
      });
      // all other URLs
      stubbedFetch.resolves(new Response("not the DNT policy"));

      // set up fake timers to simulate setTimeout and co.
      clock = sinon.useFakeTimers(+new Date());

      done();
    });
  },

  beforeEach: (/*assert*/) => {
    xhrSpy = sinon.spy(utils, "fetchResource");
  },

  afterEach: (/*assert*/) => {
    // reset call counts, etc. after each test
    utils.fetchResource.restore();
  },

  after: (/*assert*/) => {
    clock.restore();
    fetch.restore();
  }
});

QUnit.test("DNT policy checking", (assert) => {
  const NUM_TESTS = 2,
    done = assert.async(NUM_TESTS);

  assert.expect(NUM_TESTS);

  badger.checkForDNTPolicy(DNT_COMPLIANT_DOMAIN, function (successStatus) {
    assert.ok(successStatus, "Domain returns good DNT policy");
    done();
  });

  badger.checkForDNTPolicy('ecorp.example', function (successStatus) {
    assert.notOk(successStatus, "Domain returns 200 but no valid policy");
    done();
  });

  // advance the clock enough to trigger all rate-limited calls
  clock.tick(constants.DNT_POLICY_CHECK_INTERVAL * NUM_TESTS);
});

QUnit.test("Several checks for same domain resolve to one XHR", (assert) => {
  const NUM_CHECKS = 5;

  // set recheck time to now
  badger.storage.touchDNTRecheckTime(DNT_COMPLIANT_DOMAIN, +new Date());

  for (let i = 0; i < NUM_CHECKS; i++) {
    badger.checkForDNTPolicy(DNT_COMPLIANT_DOMAIN);
  }

  // advance the clock
  clock.tick(constants.DNT_POLICY_CHECK_INTERVAL * NUM_CHECKS);

  assert.equal(xhrSpy.callCount, 1, "XHR method gets called exactly once");
  assert.equal(
    xhrSpy.getCall(0).args[0],
    "https://" + DNT_COMPLIANT_DOMAIN + "/.well-known/dnt-policy.txt",
    "XHR method gets called with expected DNT URL"
  );
});

QUnit.test("DNT checking is rate limited", (assert) => {
  const NUM_TESTS = DNT_DOMAINS.length;

  let done = assert.async(NUM_TESTS);

  assert.expect(NUM_TESTS);

  for (let i = 0; i < NUM_TESTS; i++) {
    badger.checkForDNTPolicy(
      DNT_DOMAINS[i],
      function () { // eslint-disable-line no-loop-func
        assert.equal(xhrSpy.callCount, i+1);
        clock.tick(constants.DNT_POLICY_CHECK_INTERVAL);
        done();
      }
    );
  }
});

QUnit.test("DNT checking obeys user setting", (assert) => {
  const NUM_TESTS = DNT_DOMAINS.length;

  let done = assert.async(NUM_TESTS);
  let old_dnt_check_func = badger.isCheckingDNTPolicyEnabled;

  assert.expect(NUM_TESTS);
  badger.isCheckingDNTPolicyEnabled = () => false;

  for (let i = 0; i < NUM_TESTS; i++) {
    badger.checkForDNTPolicy(DNT_DOMAINS[i]);
    clock.tick(constants.DNT_POLICY_CHECK_INTERVAL);
    assert.equal(xhrSpy.callCount, 0);
    done();
  }

  badger.isCheckingDNTPolicyEnabled = old_dnt_check_func;
});

// test #1972
QUnit.test("mergeUserData does not unblock formerly blocked domains", (assert) => {
  setupBadgerStorage(badger);

  const SITE_DOMAINS = ['a.co', 'b.co', 'c.co'],
    USER_DATA = {
      action_map: {
        'foo.com': {
          dnt: false,
          heuristicAction: constants.BLOCK,
          nextUpdateTime: 100,
          userAction: ""
        }
      },
      snitch_map: {
        'foo.com': SITE_DOMAINS
      }
    };

  badger.storage.mergeUserData(USER_DATA);

  assert.equal(
    badger.storage.action_map.getItem('foo.com').heuristicAction,
    constants.BLOCK,
    "foo.com was blocked"
  );
  assert.deepEqual(
    badger.storage.snitch_map.getItem('foo.com'),
    SITE_DOMAINS,
    "snitch map was migrated"
  );
});

QUnit.test("user-blocked domains keep their tracking history", (assert) => {
  const SITE_DOMAINS = ['a.co', 'b.co'],
    USER_DATA = {
      action_map: {
        'foo.com': {
          dnt: false,
          heuristicAction: constants.ALLOW,
          nextUpdateTime: 100,
          userAction: constants.USER_BLOCK
        }
      },
      snitch_map: {
        'foo.com': SITE_DOMAINS
      }
    };

  badger.storage.mergeUserData(USER_DATA);

  assert.equal(
    badger.storage.getAction('foo.com'),
    constants.USER_BLOCK,
    "foo.com was blocked"
  );
  assert.deepEqual(
    badger.storage.snitch_map.getItem('foo.com'),
    SITE_DOMAINS,
    "snitch map was migrated"
  );
});

QUnit.test("merging snitch maps results in a blocked domain", (assert) => {
  setupBadgerStorage(badger);

  // https://github.com/EFForg/privacybadger/pull/2082#issuecomment-401942070
  const USER_DATA = {
    action_map: {
      'foo.com': {
        dnt: false,
        heuristicAction: constants.ALLOW,
        nextUpdateTime: 100,
        userAction: ""
      }
    },
    snitch_map: {'foo.com': ['b.co', 'c.co']},
  };

  badger.storage.mergeUserData(USER_DATA);

  assert.equal(
    badger.storage.action_map.getItem('foo.com').heuristicAction,
    constants.BLOCK,
    "foo.com was blocked"
  );
  assert.deepEqual(
    badger.storage.snitch_map.getItem('foo.com'),
    ['a.co', 'b.co', 'c.co'],
    "snitch map was combined"
  );
});

QUnit.test("subdomain that is not blocked does not override subdomain that is", (assert) => {
  setupBadgerStorage(badger);

  const USER_DATA = {
    action_map: {
      'sub.bar.com': {
        dnt: false,
        heuristicAction: constants.ALLOW,
        nextUpdateTime: 100,
        userAction: ""
      }
    },
    snitch_map: {'bar.com': ['a.co']}
  };

  badger.storage.mergeUserData(USER_DATA);

  assert.equal(
    badger.storage.action_map.getItem('sub.bar.com').heuristicAction,
    constants.BLOCK,
    "sub.bar.com is still blocked"
  );
  assert.deepEqual(
    badger.storage.snitch_map.getItem('bar.com'),
    ['a.co', 'b.co', 'c.co'],
    "snitch map was preserved"
  );
});

QUnit.test("subdomains on the yellowlist are preserved", (assert) => {
  const DOMAIN = "example.com",
    SUBDOMAIN = "cdn.example.com",
    USER_DATA = {
      action_map: {
        [DOMAIN]: {
          dnt: false,
          heuristicAction: constants.BLOCK,
          nextUpdateTime: 100,
          userAction: ''
        },
        [SUBDOMAIN]: {
          dnt: false,
          heuristicAction: constants.ALLOW,
          nextUpdateTime: 0,
          userAction: ''
        }
      },
      snitch_map: {
        [DOMAIN]: ['a.co', 'b.co', 'c.co'],
      }
    };

  const actionMap = badger.storage.getStore('action_map'),
    snitchMap = badger.storage.getStore('snitch_map');

  // merge in a blocked parent domain and a subdomain
  badger.storage.mergeUserData(USER_DATA);

  assert.ok(actionMap.getItem(SUBDOMAIN),
    SUBDOMAIN + " should have been preserved during merge");
  assert.equal(badger.storage.getBestAction(SUBDOMAIN), constants.BLOCK);

  // clean up
  actionMap.deleteItem(DOMAIN);
  actionMap.deleteItem(SUBDOMAIN);
  snitchMap.deleteItem(DOMAIN);

  // now add subdomain to yellowlist
  badger.storage.getStore('cookieblock_list').setItem(SUBDOMAIN, true);

  // and do the merge again
  badger.storage.mergeUserData(USER_DATA);

  assert.ok(actionMap.getItem(SUBDOMAIN),
    SUBDOMAIN + " should be present in action_map"
  );
  assert.equal(
    actionMap.getItem(SUBDOMAIN).heuristicAction,
    constants.COOKIEBLOCK,
    SUBDOMAIN + " should be cookieblocked"
  );
  assert.equal(badger.storage.getBestAction(SUBDOMAIN), constants.COOKIEBLOCK);
});

QUnit.test("mergeUserData() preserves snitch map data when no MDFP", (assert) => {
  const actionMap = badger.storage.getStore('action_map'),
    snitchMap = badger.storage.getStore('snitch_map'),
    TRACKER = 'amazon.com';

  let snitch_map = {
    [TRACKER]: ['amazonads.com', 'amazing.com', 'amazonrainforest.com']
  };
  let action_map = {
    [TRACKER]: {
      heuristicAction: "cookieblock",
      userAction: "",
      dnt: false,
      nextUpdateTime: 0,
    }
  };

  assert.notOk(actionMap.getItem(TRACKER), "no data before test");
  assert.notOk(snitchMap.getItem(TRACKER), "no data before test");

  badger.storage.mergeUserData({ action_map, snitch_map });

  assert.deepEqual(
    actionMap.getItem(TRACKER),
    action_map[TRACKER],
    "action map preserved for domain with no MDFP snitch entries"
  );
  assert.deepEqual(
    snitchMap.getItem(TRACKER),
    snitch_map[TRACKER],
    "snitch map entry with no MDFP domains remains the same after migration runs"
  );
});

QUnit.test("mergeUserData() removes MDFP entries from snitch map", (assert) => {
  const actionMap = badger.storage.getStore('action_map'),
    snitchMap = badger.storage.getStore('snitch_map'),
    TRACKER = 'amazon.com';

  let snitch_map = {
    [TRACKER]: ['amazon.ca', 'amazon.co.jp', 'amazing.com']
  };
  let action_map = {
    [TRACKER]: {
      heuristicAction: "cookieblock",
      userAction: "",
      dnt: false,
      nextUpdateTime: 0,
    }
  };

  assert.notOk(actionMap.getItem(TRACKER), "no data before test");
  assert.notOk(snitchMap.getItem(TRACKER), "no data before test");

  badger.storage.mergeUserData({ action_map, snitch_map });

  assert.equal(
    badger.storage.getAction(TRACKER),
    constants.ALLOW,
    "action downgraded to not-yet-blocked for partial MDFP domain"
  );
  assert.deepEqual(
    snitchMap.getItem(TRACKER),
    ["amazing.com"],
    "MDFP entries were removed, non-MDFP entries were left alone"
  );
});

QUnit.test("mergeUserData() clears snitch_map when all items are MDFP", (assert) => {
  const actionMap = badger.storage.getStore('action_map'),
    snitchMap = badger.storage.getStore('snitch_map'),
    TRACKER = 'amazon.com';

  let snitch_map = {
    [TRACKER]: ['amazon.ca', 'amazon.co.jp', 'amazon.es']
  };
  let action_map = {
    [TRACKER]: {
      heuristicAction: "cookieblock",
      userAction: "",
      dnt: false,
      nextUpdateTime: 0,
    }
  };

  assert.notOk(actionMap.getItem(TRACKER), "no data before test");
  assert.notOk(snitchMap.getItem(TRACKER), "no data before test");

  // confirm all entries are MDFP
  snitch_map[TRACKER].forEach(domain => {
    assert.ok(
      mdfp.isMultiDomainFirstParty(TRACKER, domain),
      `${domain} is indeed MDFP to ${TRACKER}`
    );
  });

  badger.storage.mergeUserData({ action_map, snitch_map });

  assert.equal(
    badger.storage.getAction(TRACKER),
    constants.NO_TRACKING,
    "all MDFP domain is no longer known as a tracker"
  );
  assert.notOk(
    snitchMap.getItem(TRACKER),
    "all-MDFP snitch_map data was removed entirely"
  );
});

(function () {
  let IS_UPDATE, LEARN_LOCALLY;

  let newActionMap = {
    "google-analytics.com": {
      dnt: false,
      heuristicAction: constants.BLOCK,
      nextUpdateTime: 1602152953782,
      userAction: ""
    },
    "youtube.com": {
      dnt: false,
      heuristicAction: constants.COOKIEBLOCK,
      nextUpdateTime: 0,
      userAction: ""
    },
  };
  let newSnitchMap = {
    "google-analytics.com": [
      "linkedin.com",
      "google.com",
      "godaddy.com"
    ],
    "youtube.com": [
      "apache.org",
      "github.com",
      "who.int",
    ],
  };

  QUnit.module("updateTrackerData()", {
    before: (/*assert*/) => {
      IS_UPDATE = badger.isUpdate;
      LEARN_LOCALLY = badger.getSettings().getItem("learnLocally");

      badger.isUpdate = true;
      badger.getSettings().setItem("learnLocally", false);

      stubbedFetch = sinon.stub(globalThis, 'fetch');
    },

    after: (/*assert*/) => {
      fetch.restore();

      badger.getSettings().setItem("learnLocally", LEARN_LOCALLY);
      badger.isUpdate = IS_UPDATE;
    }
  });

  QUnit.test("user-set sliders are preserved", async (assert) => {
    const NUM_TESTS = 2;
    let done = assert.async();
    assert.expect(NUM_TESTS);

    // initial state
    ["youtube.com", "linkedin.com", "netflix.com"].forEach(site => {
      badger.heuristicBlocking.updateTrackerPrevalence(
        "doubleclick.net", "doubleclick.net", site);
    });
    badger.storage.setupUserAction("example.com", constants.USER_COOKIEBLOCK);
    let customSliders = {
      "example.com": badger.storage.getStore('action_map').getItem("example.com"),
    };

    // perform the update
    stubbedFetch
      .withArgs(constants.SEED_DATA_LOCAL_URL)
      .resolves(new Response(JSON.stringify({
        action_map: newActionMap,
        snitch_map: newSnitchMap
      })));
    await badger.updateTrackerData();

    // check what happened
    let expectedActionMap = Object.assign(customSliders, newActionMap);
    assert.deepEqual(
      badger.storage.getStore('action_map').getItemClones(),
      expectedActionMap,
      "action map was replaced but custom slider was kept"
    );
    assert.deepEqual(
      badger.storage.getStore('snitch_map').getItemClones(),
      newSnitchMap,
      "snitch map was replaced"
    );

    done();
  });

  QUnit.test("user-set actions are added to heuristic actions", async (assert) => {
    const NUM_TESTS = 2;
    let done = assert.async();
    assert.expect(NUM_TESTS);

    // initial state
    ["youtube.com", "linkedin.com", "netflix.com"].forEach(site => {
      badger.heuristicBlocking.updateTrackerPrevalence(
        "doubleclick.net", "doubleclick.net", site);
    });
    // youtube.com is also in the incoming action map
    badger.storage.setupUserAction("youtube.com", constants.USER_BLOCK);

    // perform the update
    stubbedFetch
      .withArgs(constants.SEED_DATA_LOCAL_URL)
      .resolves(new Response(JSON.stringify({
        action_map: newActionMap,
        snitch_map: newSnitchMap
      })));
    await badger.updateTrackerData();

    // check what happened
    let expectedActionMap = Object.assign({}, newActionMap);
    expectedActionMap["youtube.com"].userAction = constants.USER_BLOCK;
    assert.deepEqual(
      badger.storage.getStore('action_map').getItemClones(),
      expectedActionMap,
      "action map was replaced and custom slider was merged in"
    );
    assert.deepEqual(
      badger.storage.getStore('snitch_map').getItemClones(),
      newSnitchMap,
      "snitch map was replaced"
    );

    done();
  });

}());
