/* globals badger:false */

(function () {

  let BACKUP = {};

  QUnit.config.autostart = false;
  QUnit.config.testTimeout = 6400;

  // disable storage persistence
  // unit tests shouldn't be able to affect your Badger's storage
  chrome.storage.local.set = () => {};

  // make it seem like there is nothing in storage
  // unit tests shouldn't read from your Badger's storage either
  chrome.storage.local.get = (keys, callback) => {
    // callback has to be async
    setTimeout(function () {
      callback({
        // don't open the firstrun page
        settings_map: {
          isFirstRun: false,
        }
      });
    }, 0);
  };

  // reset state between tests
  // to prevent tests affecting each other via side effects
  QUnit.testStart(() => {
    // back up settings and heuristic learning
    // TODO any other state we should reset? tabData?
    badger.storage.KEYS.forEach(item => {
      let obj = badger.storage.getBadgerStorageObject(item);
      BACKUP[item] = obj.getItemClones();
    });
  });

  QUnit.testDone(() => {
    // restore original settings and heuristic learning
    badger.storage.KEYS.forEach(item => {
      let obj = badger.storage.getBadgerStorageObject(item);
      obj.updateObject(BACKUP[item]);
    });
  });

  // kick off tests when we have what we need from Badger
  function wait_for_badger() {
    function get_storage_length(store) {
      return Object.keys(
        badger.storage.getBadgerStorageObject(store).getItemClones()
      ).length;
    }

    if (
      typeof badger == "object" &&
      badger.INITIALIZED &&
      // TODO have badger.INITIALIZED account
      // for things getting initialized async
      !!get_storage_length('dnt_hashes') &&
      !!get_storage_length('cookieblock_list')
    ) {
      QUnit.start();
    } else {
      setTimeout(wait_for_badger, 10);
    }
  }
  setTimeout(wait_for_badger, 10);

}());
