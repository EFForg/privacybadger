/* globals badger:false */
(function() {
  let settings_map, DISABLED_SITES, SHOW_COUNTER;

  module("Privacy Badger Storage", {
    setup: () => {
      settings_map = badger.storage.getBadgerStorageObject('settings_map');

      // back up original settings
      DISABLED_SITES = settings_map.getItem('disabledSites');
      SHOW_COUNTER = settings_map.getItem('showCounter');
    },

    teardown: () => {
      // restore original settings
      settings_map.setItem('disabledSites', DISABLED_SITES);
      settings_map.setItem('showCounter', SHOW_COUNTER);
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

  test("every badger storage map has a merge method", () => {
    ['action_map', 'settings_map', 'snitch_map'].forEach(obj => {
      ok(typeof badger.storage.getBadgerStorageObject(obj).merge == "function");
    });
  });

  test("settings map merging", () => {
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

})();
