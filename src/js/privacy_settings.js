require.scopes.privacySettings = (function() {

const canControl = new Set([
  'controllable_by_this_extension',
  'controlled_by_this_extension'
]);

let alternateErrorPages;
try {
  alternateErrorPages = chrome.privacy.services.alternateErrorPagesEnabled;
} catch (e) {
  alternateErrorPages = false;
}

function set(setting, obj) {
  return new Promise((resolve, reject) => {
    if (!setting) {
      return reject();
    }
    setting.set(obj, () => {
      if (chrome.runtime.lastError === undefined) {
        resolve();
      } else {
        reject(chrome.runtime.lastError);
      }
    });
  });
}

function get(setting) {
  return new Promise((resolve, reject) => {
    if (!setting) {
      return reject();
    }
    setting.get({}, function(details) {
      if (canControl.has(details.levelOfControl)) {
        resolve(details);
      } else {
        reject(details);
      }
    });
  });
}

function isAlternateErrorPagesAvailable() {
  return get(alternateErrorPages);
}

function toggleAlternateErrorPages() {
  return isAlternateErrorPagesAvailable().then(
    details => set(alternateErrorPages, {value: !details.value})
  );
}

return {isAlternateErrorPagesAvailable, toggleAlternateErrorPages};
})();
