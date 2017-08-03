(function() {
  let debug = require("debug"),
    beforeGetBadgerStorageObject = window.badger.storage.getBadgerStorageObject,
    beforeGetAllOriginsForTab = window.badger.getAllOriginsForTab;
  QUnit.module("Debug", {
    after: () => {
      window.badger.storage.getBadgerStorageObject = beforeGetBadgerStorageObject;
      window.badger.getAllOriginsForTab = beforeGetAllOriginsForTab;
    },
  });

  QUnit.test("Debug Site", (assert) => {
    // test data
    let tab = {url: 'https://testmybadger.com/', id: 14},
      testOrigins = ['foo.bar.com', 'bar.com', 'fake.stuff.com', 'more.data.com', 'otherstuff.com'].sort(),
      inActionMap = ['foo.bar.com', 'bar.com', 'fake.stuff.com', 'more.data.com', /* omit otherstuff.com for testing */].sort(),
      inSnitchMap = ['bar.com', 'stuff.com', /* omit more.data.com & otherstuff.com for testing */].sort();

    // mock
    window.badger.getAllOriginsForTab = function() {
      return testOrigins;
    };
    window.badger.storage.getBadgerStorageObject = function(name) {
      return {
        getItemClones: function() {
          let out = {};
          if (name == 'action_map') {
            inActionMap.forEach(d => {
              out[d] = {not: 'empty'};
            });
            return out;
          } else if (name == 'snitch_map') {
            inSnitchMap.forEach(d => {
              out[d] = ['not empty'];
            });
            return out;
          }
        }
      };
    };

    let result = debug.debugTab(tab);
    assert.deepEqual(result.info.origins.sort(), testOrigins.sort());
    assert.deepEqual(Object.keys(result.info.action_maps).sort(), inActionMap);
    assert.deepEqual(Object.keys(result.info.snitch_maps).sort(), inSnitchMap);
    assert.equal(result.info.fqdn, 'testmybadger.com');
  });
})();
