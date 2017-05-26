/* globals badger:false */

(function () {

  let BACKUP = {};

  QUnit.config.testTimeout = 6400;

  // disable storage persistence
  // unit tests shouldn't be able to affect your Badger's storage
  chrome.storage.local.set = () => {};

  // make it seem like there is nothing in storage
  // unit tests shouldn't read from your Badger's storage either
  chrome.storage.local.get = (_, cb) => {
    setTimeout(() => {
      cb({
        // don't open the firstrun page though
        settings_map: {
          isFirstRun: false,
        }
      });
    }, 1);
  };

  // reset state between tests
  // to prevent tests affecting each other via side effects
  QUnit.testStart(() => {
    // back up settings and heuristic learning
    // TODO any other state we should reset? tabData?
    ['action_map', 'settings_map', 'snitch_map'].forEach(item => {
      let obj = badger.storage.getBadgerStorageObject(item);
      BACKUP[item] = obj.getItemClones();
    });
  });

  QUnit.testDone(() => {
    // restore original settings and heuristic learning
    ['action_map', 'settings_map', 'snitch_map'].forEach(item => {
      let obj = badger.storage.getBadgerStorageObject(item);
      obj.updateObject(BACKUP[item]);
    });
  });

}());
