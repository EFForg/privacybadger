import constants from "../../js/constants.js";
import utils from "../../js/utils.js";

const DOMAIN = "example.com",
  SUBDOMAIN = "widgets." + DOMAIN,
  SUBSUBDOMAIN = "cdn." + SUBDOMAIN;

let storage,
  actionMap,
  snitchMap;

QUnit.module("Storage", {
  before: (assert) => {
    // can't initialize globally above
    // as they get initialized too early when run by Selenium
    storage = badger.storage;
    actionMap = storage.getStore('action_map');
    snitchMap = storage.getStore('snitch_map');

    assert.notOk(actionMap.getItem(DOMAIN),
      "test domain is not yet in action_map");
    assert.notOk(snitchMap.getItem(DOMAIN),
      "test domain is not yet in snitch_map");
  },
  afterEach: () => {
    // remove any storage subscriptions
    actionMap._subscribers = {};
  }
});

QUnit.test("test BadgerStorage methods", function (assert) {
  actionMap.setItem('foo', 'bar');
  assert.equal(actionMap.getItem('foo'), 'bar');
  assert.ok(actionMap.hasItem('foo'));
  actionMap.deleteItem('foo');
  assert.notOk(actionMap.hasItem('foo'));
  assert.equal(actionMap.getItem('foo'), null);
});

QUnit.test("getItem() returns clones of objects", function (assert) {
  actionMap.setItem("xyz", { foo: "bar" });

  // updating properties of returned objects should not update original objects
  let copyMaybe = actionMap.getItem("xyz");
  copyMaybe.foo = "baz";

  assert.deepEqual(actionMap.getItem("xyz"), { foo: "bar" },
    "object in storage should have remained the same");
});

QUnit.test("getItem() does not error out with undefined", function (assert) {
  actionMap.setItem("abc", undefined);
  assert.equal(actionMap.getItem("abc"), undefined);
});

QUnit.test("subscribing to storage changes", function (assert) {
  let done = assert.async(2);

  actionMap.subscribe("set:foo", function (val) {
    assert.equal(val, "bar", "We got notified with expected value");
    done();
  });

  actionMap.subscribe("set:foo", function (val) {
    assert.equal(val, "bar", "The second subscriber got notified too");
    done();
  });

  actionMap.subscribe("set:xyz", function () {
    assert.ok(false, "Subscribers to other storage keys should not get notified");
    done();
  });

  actionMap.setItem("foo", "bar");
});

QUnit.test("updating object properties by subscribers does not update original objects", function (assert) {
  let done = assert.async();

  actionMap.subscribe("set:xyz", function (val) {
    val.foo = "baz";
  });

  actionMap.subscribe("set:xyz", function (val) {
    assert.deepEqual(val, { foo: "bar" },
      "new value object should have remained the same");
    val.foo = "baz";

    setTimeout(function () {
      assert.deepEqual(actionMap.getItem("xyz"), { foo: "bar" },
        "storage should contain original value");
      done();
    }, 1);
  });

  actionMap.setItem("xyz", { foo: "bar" });
});

QUnit.test("subscribing to all storage keys", function (assert) {
  let done = assert.async(2);

  actionMap.subscribe("set:*", function (val, key) {
    if (key == "foo") {
      assert.equal(val, "bar", "We got notified with expected value");
      done();
    } else if (key == "abc") {
      assert.equal(val, "xyz", "We got notified again with expected value");
      done();
    } else {
      assert.ok(false, "Not expecting any other notifications");
      done();
    }
  });

  actionMap.setItem("foo", "bar");
  snitchMap.setItem("foo", "123");
  actionMap.setItem("abc", "xyz");
});

QUnit.test("subscribing to deletions", function (assert) {
  let done = assert.async(1);

  actionMap.setItem("foo", "bar");

  actionMap.subscribe("delete:foo", function () {
    assert.deepEqual(Array.from(arguments), [undefined, "foo"]);
    done();
  });

  actionMap.deleteItem("foo");
});

QUnit.test("unsubscribing from events", function (assert) {
  let done = assert.async(1);

  function handler(val) {
    assert.equal(val, 2);
    done();
  }

  // subscribe
  actionMap.subscribe("set:foo", handler);

  // remove the subscription
  let subs = actionMap.unsubscribe("set:foo");
  assert.deepEqual(subs[0], handler);

  // should not get notified
  actionMap.setItem("foo", 1);

  // re-subscribe
  actionMap.subscribe("set:foo", subs[0]);

  // should get notified
  actionMap.setItem("foo", 2);
});

QUnit.test("test user override of default action for domain", function (assert) {
  badger.saveAction("allow", "pbtest.org");
  assert.equal(storage.getAction("pbtest.org"), constants.USER_ALLOW);
  badger.saveAction("block", "pbtest.org");
  assert.equal(storage.getAction("pbtest.org"), constants.USER_BLOCK);
  badger.saveAction("allow", "pbtest.org");
  assert.equal(storage.getAction("pbtest.org"), constants.USER_ALLOW);
  storage.revertUserAction("pbtest.org");
  assert.equal(storage.getAction("pbtest.org"), constants.NO_TRACKING);
});

QUnit.test("settings map merging", (assert) => {
  let settings_map = storage.getStore('settings_map');

  function merge() {
    settings_map.merge({
      disabledSites: ['www.nytimes.com', 'example.com'],
      widgetSiteAllowlist: {
        "example.com": ["Disqus"],
        "nytimes.com": ["Facebook Like", "YouTube"],
      },
      showCounter: false,
    });
  }

  assert.ok(settings_map.getItem('showCounter'), "showCounter is enabled by default");

  merge();

  // verify
  assert.deepEqual(
    settings_map.getItem('disabledSites'),
    ['www.nytimes.com', 'example.com'],
    "disabled site lists are imported"
  );
  assert.deepEqual(
    settings_map.getItem('widgetSiteAllowlist'),
    {
      "example.com": ["Disqus"],
      "nytimes.com": ["Facebook Like", "YouTube"],
    },
    "widget site exceptions are imported"
  );
  assert.ok(!settings_map.getItem('showCounter'), "showCounter was disabled");

  // overwrite settings with test values to test combining
  settings_map.setItem('disabledSites', ['example.com']);
  settings_map.setItem('widgetSiteAllowlist', {
    "nytimes.com": ["YouTube"],
    "example.biz": ["Twitter"],
  });
  settings_map.setItem('showCounter', true);

  // merge settings
  merge();

  // verify
  assert.deepEqual(
    settings_map.getItem('disabledSites'),
    ['example.com', 'www.nytimes.com'],
    "disabled site lists are combined when merging settings"
  );
  assert.deepEqual(
    settings_map.getItem('widgetSiteAllowlist'),
    {
      "example.com": ["Disqus"],
      "nytimes.com": ["YouTube", "Facebook Like"],
      "example.biz": ["Twitter"],
    },
    "widget site exceptions are combined, discarding duplicate widgets"
  );
  assert.ok(!settings_map.getItem('showCounter'), "other settings are overwritten");
});

// previously:
// https://github.com/EFForg/privacybadger/pull/1911#issuecomment-379896911
QUnit.test("action map merge copies/breaks references", (assert) => {
  let data = {
    dnt: false,
    heuristicAction: '',
    nextUpdateTime: 100,
    userAction: 'user_block'
  };

  actionMap.merge({[DOMAIN]: data});
  assert.deepEqual(
    actionMap.getItem(DOMAIN),
    data,
    "test domain was imported");

  // set a property on the original object
  data.userAction = "user_allow";

  // this should not affect data in storage
  assert.equal(actionMap.getItem(DOMAIN).userAction,
    "user_block",
    "already imported data should be left alone " +
    "when modifying object used for import");
});

QUnit.test("action map merge only updates user action", (assert) => {
  actionMap.setItem(DOMAIN,
    {dnt: false, heuristicAction: '', nextUpdateTime: 100, userAction: ''});
  assert.equal(actionMap.getItem(DOMAIN).nextUpdateTime, 100);

  let newValue = {dnt: true, heuristicAction: constants.BLOCK,
    nextUpdateTime: 99, userAction: constants.USER_BLOCK};
  actionMap.merge({[DOMAIN]: newValue});
  assert.equal(actionMap.getItem(DOMAIN).userAction,
    constants.USER_BLOCK,
    "userAction should be merged if it's set");
  assert.equal(actionMap.getItem(DOMAIN).heuristicAction, '',
    'heuristicAction should never be overwritten');

  newValue.userAction = '';
  actionMap.merge({[DOMAIN]: newValue});
  assert.equal(actionMap.getItem(DOMAIN).userAction,
    constants.USER_BLOCK,
    'blank userAction should not overwrite anything');
});

QUnit.test("action map merge creates new entry if necessary", (assert) => {
  assert.notOk(actionMap.hasItem('newsite.com'));

  let newValue = {dnt: false, heuristicAction: constants.BLOCK,
    nextUpdateTime: 100, userAction: ''};
  actionMap.merge({'newsite.com': newValue});
  assert.notOk(actionMap.hasItem('newsite.com'),
    'action map entry should not be created for heuristicAction alone');

  newValue.userAction = constants.USER_BLOCK;
  actionMap.merge({'newsite.com': newValue});
  assert.ok(actionMap.hasItem('newsite.com'),
    'action map entry should be created if userAction is set');

  actionMap.deleteItem('newsite.com');

  newValue.userAction = '';
  newValue.dnt = true;
  actionMap.merge({'newsite.com': newValue});
  assert.ok(actionMap.hasItem('newsite.com'),
    'action map entry should be created if DNT is set');
});

QUnit.test("action map merge updates with latest DNT info", (assert) => {
  actionMap.setItem(DOMAIN,
    {dnt: false, heuristicAction: '', nextUpdateTime: 100, userAction: ''});

  // DNT should not be merged if nextUpdateTime is earlier
  let newValue = {dnt: true, heuristicAction: '', nextUpdateTime: 99, userAction: ''};
  actionMap.merge({[DOMAIN]: newValue});
  assert.equal(actionMap.getItem(DOMAIN).nextUpdateTime, 100,
    'nextUpdateTime should not be changed to an earlier time');
  assert.notOk(actionMap.getItem(DOMAIN).dnt,
    'DNT value should not be updated by out-of-date information');

  // DNT should be merged if it's more up-to-date
  newValue.nextUpdateTime = 101;
  actionMap.merge({[DOMAIN]: newValue});
  assert.equal(actionMap.getItem(DOMAIN).nextUpdateTime, 101,
    'nextUpdateTime should be updated to later time');
  assert.ok(actionMap.getItem(DOMAIN).dnt,
    'DNT value should be updated with more recent information');
});

QUnit.test("action map merge handles missing nextUpdateTime", (assert) => {
  let newValue = {
    dnt: true,
    heuristicAction: '',
    userAction: ''
  };

  assert.notOk(utils.hasOwn(newValue, 'nextUpdateTime'),
    "nextUpdateTime is indeed missing from the import");

  // new DNT domain should be imported
  actionMap.merge({[DOMAIN]: newValue});
  assert.deepEqual(
    actionMap.getItem(DOMAIN),
    Object.assign({ nextUpdateTime: 0 }, newValue),
    "test domain was imported and nextUpdateTime got initialized");

  // existing DNT domain should be left alone
  // as we don't know how fresh the import is
  newValue.dnt = false;
  actionMap.merge({[DOMAIN]: newValue});
  assert.ok(actionMap.getItem(DOMAIN).dnt,
    "existing data should be left alone " +
    "when unable to determine recency of new data");

  // now set the timestamp and try again
  newValue.nextUpdateTime = 200;
  actionMap.merge({[DOMAIN]: newValue});
  assert.notOk(actionMap.getItem(DOMAIN).dnt,
    "DNT got overridden now that new data seems fresher");
});

QUnit.test("action map merge handles missing userAction", (assert) => {
  let newValue = {
    heuristicAction: 'allow',
    dnt: true,
    nextUpdateTime: 100
  };

  // import and check that userAction got initialized
  actionMap.merge({[DOMAIN]: newValue});
  assert.deepEqual(
    actionMap.getItem(DOMAIN),
    Object.assign({ userAction: '' }, newValue),
    "test domain was imported and userAction got initialized");
});

QUnit.test("action map merge handles missing dnt", (assert) => {
  let newValue = {
    heuristicAction: 'block',
    userAction: 'user_allow'
  };

  // import and check that userAction got initialized
  actionMap.merge({[DOMAIN]: newValue});
  assert.deepEqual(
    actionMap.getItem(DOMAIN),
    Object.assign({ dnt: false, nextUpdateTime: 0 }, newValue),
    "test domain was imported and DNT got initialized");
});

QUnit.test("action map merge handles subdomains correctly", (assert) => {
  actionMap.setItem('testsite.com',
    {dnt: false, heuristicAction: '', nextUpdateTime: 100, userAction: ''});

  let newValue = {dnt: true, heuristicAction: '', nextUpdateTime: 100, userAction: ''};

  actionMap.merge({'s1.testsite.com': newValue});
  assert.ok(actionMap.hasItem('s1.testsite.com'),
    'Subdomains should be merged if they honor DNT');

  newValue.dnt = false;
  actionMap.merge({'s2.testsite.com': newValue});
  assert.notOk(actionMap.hasItem('s2.testsite.com'),
    "Subdomains should not be merged if they don't honor DNT");
});

QUnit.test("snitch map merging", (assert) => {
  snitchMap.merge({[DOMAIN]: ['firstparty.org']});
  assert.ok(snitchMap.getItem(DOMAIN).indexOf('firstparty.org') > -1);

  // Check to make sure existing and new domain are present
  snitchMap.merge({[DOMAIN]: ['firstparty2.org']});
  assert.ok(snitchMap.getItem(DOMAIN).indexOf('firstparty.org') > -1);
  assert.ok(snitchMap.getItem(DOMAIN).indexOf('firstparty2.org') > -1);

  // Verify 'block' status is triggered once TRACKING_THRESHOLD is hit
  assert.equal(actionMap.getItem(DOMAIN).heuristicAction, "allow");
  snitchMap.merge({[DOMAIN]: ["firstparty3.org"]});
  assert.equal(actionMap.getItem(DOMAIN).heuristicAction, "block");
});

QUnit.test("unknown domains are reported as non-tracking", async (assert) => {
  const UHOST = "thisdomainshouldnotbepresentinprivacybadgerstorage.com";

  let done = assert.async();

  assert.notOk(actionMap.getItem(UHOST));
  assert.notOk(snitchMap.getItem(UHOST));
  assert.equal(
    storage.getBestAction(UHOST),
    constants.NO_TRACKING,
    "best action for unknown domain is 'no tracking'"
  );

  await badger.loadSeedData();

  assert.notOk(actionMap.getItem(UHOST));
  assert.notOk(snitchMap.getItem(UHOST));
  assert.equal(
    storage.getBestAction(UHOST),
    constants.NO_TRACKING,
    "best action for unknown domain is still 'no tracking'"
  );
  done();
});

QUnit.test("blocking cascades", (assert) => {
  // mark domain for blocking
  storage.setupHeuristicAction(DOMAIN, constants.BLOCK);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    constants.BLOCK,
    "domain is marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.BLOCK,
    "domain is marked for blocking"
  );

  // check that subdomain inherits blocking
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.NO_TRACKING,
    "subdomain is not marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.BLOCK,
    "subdomain is marked for blocking (via parent domain)"
  );

  // check that subsubdomain inherits blocking
  assert.equal(
    storage.getAction(SUBSUBDOMAIN),
    constants.NO_TRACKING,
    "subsubdomain is not marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(SUBSUBDOMAIN),
    constants.BLOCK,
    "subsubdomain is marked for blocking (via grandparent domain)"
  );
});

QUnit.test("DNT does not cascade", (assert) => {
  storage.setupDNT(DOMAIN);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    constants.DNT,
    "domain is marked as DNT directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.DNT,
    "domain is marked as DNT"
  );

  // check that subdomain does not inherit DNT
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.NO_TRACKING,
    "subdomain is not marked as DNT directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.NO_TRACKING,
    "subdomain is not marked as DNT (via parent domain)"
  );
});

QUnit.test("DNT does not return as an action if user has chosen not to", (assert) => {
  let settings_map = storage.getStore('settings_map');
  settings_map.setItem("checkForDNTPolicy", false);
  storage.setupDNT(DOMAIN);

  assert.equal(
    storage.getAction(DOMAIN),
    constants.NO_TRACKING,
    "domain is marked as DNT directly, but returns as NO_TRACKING because user has disabled DNT"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.NO_TRACKING,
    "domain is marked as DNT, but returns as NO_TRACKING because user has disabled DNT"
  );
});

QUnit.test("blocking still cascades after domain declares DNT", (assert) => {
  storage.setupHeuristicAction(DOMAIN, constants.BLOCK);
  storage.setupDNT(DOMAIN);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN, true),
    constants.BLOCK,
    "domain is marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.DNT,
    "domain is marked as DNT"
  );

  // check that subdomain inherits blocking
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.NO_TRACKING,
    "subdomain is not marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.BLOCK,
    "subdomain is marked for blocking (via parent domain)"
  );
});

QUnit.test("cascading doesn't work the other way", (assert) => {
  // mark subdomain for blocking
  storage.setupHeuristicAction(SUBDOMAIN, constants.BLOCK);

  // check subdomain itself
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.BLOCK,
    "subdomain is marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.BLOCK,
    "subdomain is marked for blocking"
  );

  // check that parent domain does not inherit blocking
  assert.equal(
    storage.getAction(DOMAIN),
    constants.NO_TRACKING,
    "domain is not marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.NO_TRACKING,
    "domain is not marked for blocking"
  );
});

QUnit.test("blocking overrules allowing", (assert) => {
  // mark domain for blocking
  storage.setupHeuristicAction(DOMAIN, constants.BLOCK);
  // mark subsubdomain as "allow" (not-yet-over-the-threshold tracker)
  storage.setupHeuristicAction(SUBSUBDOMAIN, constants.ALLOW);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    constants.BLOCK,
    "domain is marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.BLOCK,
    "domain is marked for blocking"
  );

  // check that subsubdomain inherits blocking
  assert.equal(
    storage.getAction(SUBSUBDOMAIN),
    constants.ALLOW,
    "subdomain is marked as 'allow' directly"
  );
  assert.equal(
    storage.getBestAction(SUBSUBDOMAIN),
    constants.BLOCK,
    "subsubdomain is marked for blocking (via grandparent domain)"
  );
});

QUnit.test("cookieblocking overrules blocking", (assert) => {
  // mark domain for cookieblocking
  storage.setupHeuristicAction(DOMAIN, constants.COOKIEBLOCK);
  // mark subdomain for blocking
  storage.setupHeuristicAction(SUBDOMAIN, constants.BLOCK);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    constants.COOKIEBLOCK,
    "domain is marked for cookieblocking directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.COOKIEBLOCK,
    "domain is marked for cookieblocking"
  );

  // check that subdomain inherits cookieblocking
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.BLOCK,
    "subdomain is marked for blocking directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.COOKIEBLOCK,
    "subdomain is marked for cookieblocking (via parent domain)"
  );
});

QUnit.test("user actions overrule everything else", (assert) => {
  storage.setupUserAction(DOMAIN, constants.USER_BLOCK);
  storage.setupHeuristicAction(SUBDOMAIN, constants.COOKIEBLOCK);
  storage.setupDNT(SUBSUBDOMAIN);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    constants.USER_BLOCK,
    "domain is marked as userblock directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.USER_BLOCK,
    "domain is marked as userblock"
  );

  // check subdomain
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.COOKIEBLOCK,
    "subdomain is marked for cookie blocking directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.USER_BLOCK,
    "subdomain is marked as userblock"
  );

  // check subsubdomain
  assert.equal(
    storage.getAction(SUBSUBDOMAIN),
    constants.DNT,
    "subsubdomain is marked as DNT directly"
  );
  assert.equal(
    storage.getBestAction(SUBSUBDOMAIN),
    constants.USER_BLOCK,
    "subsubdomain is marked as userblock"
  );
});

// all three user actions are equally important
// but the one closest to the FQDN being checked should win
QUnit.test("specificity of rules of equal priority", (assert) => {
  storage.setupUserAction(DOMAIN, constants.USER_BLOCK);
  storage.setupUserAction(SUBDOMAIN, constants.USER_ALLOW);
  storage.setupUserAction(SUBSUBDOMAIN, constants.USER_COOKIEBLOCK);

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    constants.USER_BLOCK,
    "domain is marked as userblock directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.USER_BLOCK,
    "domain is marked as userblock"
  );

  // check subdomain
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.USER_ALLOW,
    "subdomain is marked as userallow directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.USER_ALLOW,
    "subdomain is marked as userallow"
  );

  // check subsubdomain
  assert.equal(
    storage.getAction(SUBSUBDOMAIN),
    constants.USER_COOKIEBLOCK,
    "subsubdomain is marked as usercookieblock directly"
  );
  assert.equal(
    storage.getBestAction(SUBSUBDOMAIN),
    constants.USER_COOKIEBLOCK,
    "subsubdomain is marked as usercookieblock"
  );
});

QUnit.test("unexpected heuristic actions are ignored", (assert) => {
  storage.setupHeuristicAction(DOMAIN, "foo");
  storage.setupHeuristicAction(SUBDOMAIN, constants.ALLOW);
  storage.setupHeuristicAction(SUBSUBDOMAIN, "bar");

  // check domain itself
  assert.equal(
    storage.getAction(DOMAIN),
    "foo",
    "domain is marked as 'foo' directly"
  );
  assert.equal(
    storage.getBestAction(DOMAIN),
    constants.NO_TRACKING,
    "best action for domain is 'no tracking'"
  );

  // check subdomain
  assert.equal(
    storage.getAction(SUBDOMAIN),
    constants.ALLOW,
    "subdomain is marked as 'allow' directly"
  );
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.ALLOW,
    "best action for subdomain is 'allow'"
  );

  // check subsubdomain
  assert.equal(
    storage.getAction(SUBSUBDOMAIN),
    "bar",
    "subsubdomain is marked as 'bar' directly"
  );
  assert.equal(
    storage.getBestAction(SUBSUBDOMAIN),
    constants.ALLOW,
    "best action for subsubdomain is 'allow'"
  );
});

function checkCookieblocking(assert) {
  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.NO_TRACKING,
    "subdomain is not yet (cookie)blocked"
  );
  assert.ok(
    storage.wouldGetCookieblocked(SUBDOMAIN),
    "subdomain would get cookieblocked if blocked"
  );

  // block the subdomain
  badger.heuristicBlocking.blocklistOrigin(DOMAIN, SUBDOMAIN);

  assert.equal(
    storage.getBestAction(SUBDOMAIN),
    constants.COOKIEBLOCK,
    "subdomain is cookieblocked"
  );
  assert.ok(
    storage.wouldGetCookieblocked(SUBDOMAIN),
    "subdomain would get/is cookieblocked"
  );
}

QUnit.test("checking cookieblock potential for yellowlisted subdomain", (assert) => {
  assert.notOk(
    storage.wouldGetCookieblocked(SUBDOMAIN),
    "subdomain wouldn't get cookieblocked if blocked"
  );

  // add subdomain to yellowlist
  storage.getStore('cookieblock_list').setItem(SUBDOMAIN, true);

  checkCookieblocking(assert);
});

QUnit.test("checking cookieblock potential for subdomain with yellowlisted base domain", (assert) => {
  assert.notOk(
    storage.wouldGetCookieblocked(SUBDOMAIN),
    "subdomain wouldn't get cookieblocked if blocked"
  );

  // add base domain to yellowlist
  storage.getStore('cookieblock_list').setItem(DOMAIN, true);

  checkCookieblocking(assert);
});
