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
      // don't open the new user intro page or load seed data
      private_storage: {
        badgerVersion: chrome.runtime.getManifest().version,
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
    let obj = badger.storage.getStore(item);
    BACKUP[item] = obj.getItemClones();
  });
});

QUnit.testDone(() => {
  // restore original settings and heuristic learning
  badger.storage.KEYS.forEach(item => {
    let obj = badger.storage.getStore(item);
    obj.updateObject(BACKUP[item]);
  });
});

// kick off tests when we have what we need from Badger
(function () {

  const WAIT_INTERVAL = 10,
    MAX_WAIT = 1000;

  let elapsed = 0;

  function wait_for_badger() {
    elapsed += WAIT_INTERVAL;

    if (elapsed >= MAX_WAIT) {
      // give up
      QUnit.start();
    }

    if (typeof badger == "object" && badger.INITIALIZED) {
      QUnit.start();
    } else {
      setTimeout(wait_for_badger, WAIT_INTERVAL);
    }
  }

  setTimeout(wait_for_badger, WAIT_INTERVAL);

}());

}());
