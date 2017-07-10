/* globals badger:false */

(function () {

  const DNT_HASHES_URL = chrome.extension.getURL(
    'data/dnt-policies-example.json');

  let BACKUP = {};

  QUnit.config.testTimeout = 6400;

  // disable storage persistence
  // unit tests shouldn't be able to affect your Badger's storage
  chrome.storage.local.set = () => {};

  // make it seem like there is nothing in storage
  // unit tests shouldn't read from your Badger's storage either
  chrome.storage.local.get = (keys, callback) => {
    // note that callback has to be async

    // ensure DNT hashes are loaded
    // TODO anything else tests depend on that might not yet be ready
    // at the time tests run?
    // TODO would be better to set QUnit.config.autostart to false
    // and QUnit.start() tests only when Badger declares itself ready
    require('utils').xhrRequest(DNT_HASHES_URL, (err, data) => {
      callback({
        dnt_hashes: _.invert(JSON.parse(data)),

        // don't open the firstrun page
        settings_map: {
          isFirstRun: false,
        }
      });
    });
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

}());
