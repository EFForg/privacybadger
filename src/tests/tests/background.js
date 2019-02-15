/* globals badger:false */

(function () {

const DNT_COMPLIANT_DOMAIN = 'eff.org',
  DNT_DOMAINS = [
    DNT_COMPLIANT_DOMAIN,
    'dnt2.example',
    'dnt3.example',
    'dnt4.example',
    'dnt5.example',
  ],
  POLICY_URL = chrome.runtime.getURL('data/dnt-policy.txt');

let utils = require('utils'),
  constants = require('constants');

let clock,
  server,
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
    utils.xhrRequest(POLICY_URL, function (err, data) {
      dnt_policy_txt = data;

      // set up fake server to simulate XMLHttpRequests
      server = sinon.fakeServer.create({
        respondImmediately: true
      });
      DNT_DOMAINS.forEach(domain => {
        server.respondWith(
          "GET",
          "https://" + domain + "/.well-known/dnt-policy.txt",
          [200, {}, dnt_policy_txt]
        );
      });

      // set up fake timers to simulate window.setTimeout and co.
      clock = sinon.useFakeTimers(+new Date());

      done();
    });
  },

  beforeEach: (/*assert*/) => {
    // spy on utils.xhrRequest
    xhrSpy = sinon.spy(utils, "xhrRequest");
  },

  afterEach: (/*assert*/) => {
    // reset call counts, etc. after each test
    utils.xhrRequest.restore();
  },

  after: (/*assert*/) => {
    clock.restore();
    server.restore();
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
      },
      settings_map: {
        migrationLevel: 0
      }
    };

  badger.mergeUserData(USER_DATA);

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

  badger.runMigrations();

  assert.equal(
    badger.storage.action_map.getItem('foo.com').heuristicAction,
    constants.BLOCK,
    "foo.com is still blocked after running migrations"
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

  badger.mergeUserData(USER_DATA);

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

  badger.mergeUserData(USER_DATA);

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

  badger.mergeUserData(USER_DATA);

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

  const actionMap = badger.storage.getBadgerStorageObject('action_map'),
    snitchMap = badger.storage.getBadgerStorageObject('snitch_map');

  // merge in a blocked parent domain and a subdomain
  badger.mergeUserData(USER_DATA);

  assert.notOk(actionMap.getItem(SUBDOMAIN),
    SUBDOMAIN + " should have been discarded during merge"
  );

  // clean up
  actionMap.deleteItem(DOMAIN);
  actionMap.deleteItem(SUBDOMAIN);
  snitchMap.deleteItem(DOMAIN);

  // now add subdomain to yellowlist
  badger.storage.getBadgerStorageObject('cookieblock_list')
    .setItem(SUBDOMAIN, true);

  // and do the merge again
  badger.mergeUserData(USER_DATA);

  assert.ok(actionMap.getItem(SUBDOMAIN),
    SUBDOMAIN + " should be present in action_map"
  );
  assert.equal(
    actionMap.getItem(SUBDOMAIN).heuristicAction,
    constants.COOKIEBLOCK,
    SUBDOMAIN + " should be cookieblocked"
  );
});

}());
