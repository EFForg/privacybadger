/* globals badger:false */
(function() {
  let BACKUP = {};

  module("Privacy Badger Storage", {
    // note: setup is not module-level, called before every test
    setup: () => {
      // back up settings and heuristic learning
      ['action_map', 'settings_map', 'snitch_map'].forEach(item => {
        let obj = badger.storage.getBadgerStorageObject(item);
        BACKUP[item] = obj.getItemClones();
      });
    },

    // called after every test
    teardown: () => {
      // restore original settings and heuristic learning
      ['action_map', 'settings_map', 'snitch_map'].forEach(item => {
        let obj = badger.storage.getBadgerStorageObject(item);
        obj.updateObject(BACKUP[item]);
      });
    }
  });

  test("testGetBadgerStorage", function(){
    expect(1);
    var action_map = badger.storage.getBadgerStorageObject('action_map');
    ok(action_map.updateObject instanceof Function, "action_map is a pbstorage");
  });

  test("test BadgerStorage methods", function(){
    expect(3);
    var action_map = badger.storage.getBadgerStorageObject('action_map');
    action_map.setItem('foo', 'bar');
    ok(action_map.getItem('foo') === 'bar');
    ok(action_map.hasItem('foo'));
    action_map.deleteItem('foo');
    ok(!action_map.hasItem('foo'));
  });

  test("test user override of default action for domain", function(){
    expect(4);
    badger.saveAction("allow", "pbtest.org");
    ok(badger.userAllow.indexOf('pbtest.org') > -1);
    badger.saveAction("block", "pbtest.org");
    ok(badger.userAllow.indexOf('pbtest.org') <= -1);
    badger.saveAction("allow", "pbtest.org");
    ok(badger.userAllow.indexOf('pbtest.org') > -1);
    badger.storage.revertUserAction("pbtest.org");
    ok(badger.userAllow.indexOf('pbtest.org') <= -1);
  });

  test("data persists to local storage", function(){
    // TODO: Figure out how to test this.
    expect(1); //expect 1 assertion
    /*var action_map = BadgerStore.getBadgerStorageObject('action_map');
    action_map.setItem('foo', 'bar');
    setTimeout(function(){
      var data = JSON.parse(localStorage.getItem('action_map'));
      ok(data.foo == 'bar', "data persists to local storage");
      start();
    }, 500);*/
    ok(true);
  });

  test("settings map merging", () => {
    let settings_map = badger.storage.getBadgerStorageObject('settings_map');

    // overwrite settings with test values
    settings_map.setItem('disabledSites', ['example.com']);
    settings_map.setItem('showCounter', true);

    // merge settings
    settings_map.merge({
      disabledSites: ['www.nytimes.com'],
      showCounter: false,
    });

    // verify
    deepEqual(
     settings_map.getItem('disabledSites'),
     ['example.com', 'www.nytimes.com'],
      "disabled site lists are combined when merging settings"
    );
    ok(!settings_map.getItem('showCounter'), "other settings are overwritten");
  });

  test("action map merging", () => {
    expect(2);
    let action_map = badger.storage.getBadgerStorageObject('action_map');

    action_map.setItem('testsite.com',
        {dnt: false, heuristicAction: "", nextUpdateTime: 100, userAction: ""});
    ok(action_map.getItem('testsite.com').nextUpdateTime === 100);

    let newValue = {dnt: false, heuristicAction: "", nextUpdateTime: 101, userAction: ""};
    action_map.merge({'testsite.com': newValue});

    // Merged in object should have new nextUpdateTime value
    ok(action_map.getItem('testsite.com').nextUpdateTime === 101);
  });


  test("snitch map merging", () => {
    expect(5);
    let snitch_map = badger.storage.getBadgerStorageObject('snitch_map');
    let action_map = badger.storage.getBadgerStorageObject('action_map');

    snitch_map.merge({"testsite.com": ['firstparty.org']});
    ok(snitch_map.getItem('testsite.com').indexOf('firstparty.org') > -1);

    // Check to make sure existing and new domain are present
    snitch_map.merge({"testsite.com": ['firstparty2.org']});
    ok(snitch_map.getItem('testsite.com').indexOf('firstparty.org') > -1);
    ok(snitch_map.getItem('testsite.com').indexOf('firstparty2.org') > -1);

    // Verify 'block' status is triggered once TRACKING_THRESHOLD is hit
    ok(action_map.getItem('testsite.com').heuristicAction === "allow");
    snitch_map.merge({'testsite.com': ["firstparty3.org"]});
    ok(action_map.getItem('testsite.com').heuristicAction === "block");
  });

})();
