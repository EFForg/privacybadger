/* globals badger:false */

(function () {

  let BACKUP = {};

  QUnit.config.testTimeout = 6400;

  // runs before any tests begin
  QUnit.begin(() => {
    // disable storage persistence
    chrome.storage.local.set = () => {};

    // set defaults
    var settings = badger.storage.getBadgerStorageObject("settings_map");
    for (let key in badger.defaultSettings) {
      settings.setItem(key, badger.defaultSettings[key]);
    }
  });

  // runs after all tests finished
  QUnit.done(() => {
  });

  QUnit.testStart(() => {
    // back up settings and heuristic learning
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
