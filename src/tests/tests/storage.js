/* globals badger:false, constants:false */

(function () {

  const DOMAIN = "example.com",
    SUBDOMAIN = "widgets." + DOMAIN,
    SUBSUBDOMAIN = "cdn." + SUBDOMAIN;

  let BACKUP = {};

  let storage = badger.storage;

  QUnit.module("Storage", {
    // called before every test
    beforeEach: () => {
      // back up settings and heuristic learning
      ['action_map', 'settings_map', 'snitch_map'].forEach(item => {
        let obj = storage.getBadgerStorageObject(item);
        BACKUP[item] = obj.getItemClones();
      });
    },

    // called after every test
    afterEach: () => {
      // restore original settings and heuristic learning
      ['action_map', 'settings_map', 'snitch_map'].forEach(item => {
        let obj = storage.getBadgerStorageObject(item);
        obj.updateObject(BACKUP[item]);
      });
    }
  });

  QUnit.test("testGetBadgerStorage", function (assert) {
    var action_map = storage.getBadgerStorageObject('action_map');
    assert.ok(action_map.updateObject instanceof Function, "action_map is a pbstorage");
  });

  QUnit.test("test BadgerStorage methods", function (assert) {
    var action_map = storage.getBadgerStorageObject('action_map');
    action_map.setItem('foo', 'bar');
    assert.ok(action_map.getItem('foo') === 'bar');
    assert.ok(action_map.hasItem('foo'));
    action_map.deleteItem('foo');
    assert.ok(!action_map.hasItem('foo'));
  });

  QUnit.test("test user override of default action for domain", function (assert) {
    badger.saveAction("allow", "pbtest.org");
    assert.ok(badger.userAllow.indexOf('pbtest.org') > -1);
    badger.saveAction("block", "pbtest.org");
    assert.ok(badger.userAllow.indexOf('pbtest.org') <= -1);
    badger.saveAction("allow", "pbtest.org");
    assert.ok(badger.userAllow.indexOf('pbtest.org') > -1);
    storage.revertUserAction("pbtest.org");
    assert.ok(badger.userAllow.indexOf('pbtest.org') <= -1);
  });

  // TODO: Figure out how to test this.
  QUnit.skip("data persists to local storage", function (/*assert*/) {
    /*let done = assert.async();
    var action_map = BadgerStore.getBadgerStorageObject('action_map');
    action_map.setItem('foo', 'bar');
    setTimeout(function(){
      var data = JSON.parse(localStorage.getItem('action_map'));
      assert.ok(data.foo == 'bar', "data persists to local storage");
      done();
    }, 500);*/
  });

  QUnit.test("settings map merging", (assert) => {
    let settings_map = storage.getBadgerStorageObject('settings_map');

    // overwrite settings with test values
    settings_map.setItem('disabledSites', ['example.com']);
    settings_map.setItem('showCounter', true);

    // merge settings
    settings_map.merge({
      disabledSites: ['www.nytimes.com'],
      showCounter: false,
    });

    // verify
    assert.deepEqual(
     settings_map.getItem('disabledSites'),
     ['example.com', 'www.nytimes.com'],
      "disabled site lists are combined when merging settings"
    );
    assert.ok(!settings_map.getItem('showCounter'), "other settings are overwritten");
  });

  QUnit.test("action map merging", (assert) => {
    let action_map = storage.getBadgerStorageObject('action_map');

    action_map.setItem('testsite.com',
        {dnt: false, heuristicAction: "", nextUpdateTime: 100, userAction: ""});
    assert.ok(action_map.getItem('testsite.com').nextUpdateTime === 100);

    let newValue = {dnt: false, heuristicAction: "", nextUpdateTime: 101, userAction: ""};
    action_map.merge({'testsite.com': newValue});

    // Merged in object should have new nextUpdateTime value
    assert.ok(action_map.getItem('testsite.com').nextUpdateTime === 101);
  });


  QUnit.test("snitch map merging", (assert) => {
    let snitch_map = storage.getBadgerStorageObject('snitch_map');
    let action_map = storage.getBadgerStorageObject('action_map');

    snitch_map.merge({"testsite.com": ['firstparty.org']});
    assert.ok(snitch_map.getItem('testsite.com').indexOf('firstparty.org') > -1);

    // Check to make sure existing and new domain are present
    snitch_map.merge({"testsite.com": ['firstparty2.org']});
    assert.ok(snitch_map.getItem('testsite.com').indexOf('firstparty.org') > -1);
    assert.ok(snitch_map.getItem('testsite.com').indexOf('firstparty2.org') > -1);

    // Verify 'block' status is triggered once TRACKING_THRESHOLD is hit
    assert.ok(action_map.getItem('testsite.com').heuristicAction === "allow");
    snitch_map.merge({'testsite.com': ["firstparty3.org"]});
    assert.ok(action_map.getItem('testsite.com').heuristicAction === "block");
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
    storage.setupUserAction(SUBSUBDOMAIN, constants.USER_COOKIE_BLOCK);

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
      constants.USER_COOKIE_BLOCK,
      "subsubdomain is marked as usercookieblock directly"
    );
    assert.equal(
      storage.getBestAction(SUBSUBDOMAIN),
      constants.USER_COOKIE_BLOCK,
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

}());
