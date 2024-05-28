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
  scripting: {
    ExecutionWorld: {
      MAIN: "MAIN"
    }
  }
};
