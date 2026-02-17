/**
 * Shims certain browser extension and badger global object APIs
 * to enable use of Privacy Badger modules outside the browser.
 */

globalThis.chrome = {
  runtime: {
    getURL: function (path) {
      if (!path || !path.startsWith("/")) {
        path = "/" + path;
      }
      return path;
    }
  },
  storage: {
    local: {
      get: function (keys, callback) {
        setTimeout(function () {
          callback({
            private_storage: {
              blockThreshold: 3,
              ignoredSiteBases: [],
            }
          });
        }, 0);
      },
      set: (_, callback) => {
        if (callback) {
          setTimeout(function () {
            callback(null);
          }, 0);
        }
      }
    }
  },
  tabs: {
    query: function (opts, callback) {
      setTimeout(function () {
        callback([]);
      }, 0);
    }
  }
};

globalThis.badger = {
  getSettings: () => {
    return {
      subscribe: () => {}
    };
  },
  initSettings: () => {},
  isCheckingDNTPolicyEnabled: () => true,
  initWelcomePage: () => {},
};
