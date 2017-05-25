/* globals badger:false */

(function () {

  let BACKUP = {};

  QUnit.config.testTimeout = 6400;

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
