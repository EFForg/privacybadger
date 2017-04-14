/* globals badger:false, constants:false */

(function () {

  const DOMAIN = "example.com",
    SUBDOMAIN = "widgets.example.com";

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
    // mark a domain for blocking
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

}());
