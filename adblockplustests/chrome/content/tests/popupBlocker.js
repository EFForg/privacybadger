(function()
{
  let server = null;
  let frame = null;

  module("Pop-up blocker", {
    setup: function()
    {
      prepareFilterComponents.call(this, true);
      preparePrefs.call(this);

      server = new nsHttpServer();
      server.start(1234);

      server.registerPathHandler("/test", function(metadata, response)
      {
        response.setStatusLine("1.1", "200", "OK");
        response.setHeader("Content-Type", "text/html; charset=utf-8");

        let body = '<html><body><a id="link" href="/redirect" target="_blank">link</a></body></html>';
        response.bodyOutputStream.write(body, body.length);
      });
      server.registerPathHandler("/redirect", function(metadata, response)
      {
        response.setStatusLine("1.1", "302", "Moved Temporarily");
        response.setHeader("Location", "http://127.0.0.1:1234/target");
      });
      server.registerPathHandler("/target", function(metadata, response)
      {
        response.setStatusLine("1.1", "302", "Moved Temporarily");
        response.setHeader("Content-Type", "text/html; charset=utf-8");

        let body = '<html><body>OK</body></html>';
        response.bodyOutputStream.write(body, body.length);
      });

      frame = document.createElement("iframe");
      frame.setAttribute("src", "http://127.0.0.1:1234/test");
      frame.style.visibility = "collapse";
      document.body.appendChild(frame);

      stop();
      frame.addEventListener("load", function(event)
      {
        start();
      }, false);
    },
    teardown: function()
    {
      restoreFilterComponents.call(this);
      restorePrefs.call(this);

      stop();
      server.stop(function()
      {
        frame.parentElement.removeChild(frame);

        server = null;
        frame = null;

        start();
      });
    }
  });

  let tests = [
    ["||127.0.0.1:1234/target$popup", false],
    ["||127.0.0.1:1234/target$~subdocument", true],
    ["||127.0.0.1:1234/target$popup,domain=127.0.0.1", false],
    ["||127.0.0.1:1234/target$popup,domain=128.0.0.1", true],
    ["||127.0.0.1:1234/redirect$popup", false],
    ["||127.0.0.1:1234/redirect$~subdocument", true],
    ["||127.0.0.1:1234/redirect$popup,domain=127.0.0.1", false],
    ["||127.0.0.1:1234/redirect$popup,domain=128.0.0.1", true],

    // These are messed up by bug 467514 (a click inside a frame opening a new
    // tab should be considered as type document, not subdocument). We cannot
    // fix the bug but at least we can ensure consistent results.
    ["||127.0.0.1:1234/target$subdocument", false],
    ["||127.0.0.1:1234/target$subdocument,domain=127.0.0.1", false],
    ["||127.0.0.1:1234/target$subdocument,domain=128.0.0.1", true],
    ["||127.0.0.1:1234/redirect$subdocument", false],
    ["||127.0.0.1:1234/redirect$subdocument,domain=127.0.0.1", false],
    ["||127.0.0.1:1234/redirect$subdocument,domain=128.0.0.1", true],
  ];

  function runTest(filter, result)
  {
    FilterStorage.addFilter(filter);

    let successful = false;
    let wnd = Utils.getChromeWindow(window);

    function onTabOpen(event)
    {
      window.clearTimeout(timeout);
      wnd.gBrowser.tabContainer.removeEventListener("TabOpen", onTabOpen, false);

      let tab = event.target;
      let browser = wnd.gBrowser.getBrowserForTab(tab);
      Utils.runAsync(function()
      {
        browser.contentWindow.addEventListener("load", function(event)
        {
          if (browser.contentDocument.body.textContent.indexOf("OK") >= 0)
            successful = true;

          browser.contentWindow.close();
        }, false);
      });
    }

    function onTabClose(event)
    {
      wnd.gBrowser.tabContainer.removeEventListener("TabClose", onTabClose, false);
      ok(result == successful, "Opening tab with filter " + filter.text);
      var keys = [];
      for (key in defaultMatcher.blacklist.keywordByFilter)
        keys.push(key);
      Cu.reportError(filter instanceof RegExpFilter);

      FilterStorage.removeFilter(filter);
      start();
    }

    wnd.gBrowser.tabContainer.addEventListener("TabOpen", onTabOpen, false);
    wnd.gBrowser.tabContainer.addEventListener("TabClose", onTabClose, false);
    let timeout = window.setTimeout(onTabClose, 1000);    // In case the tab isn't opened

    frame.contentDocument.getElementById("link").click();
  }

  for each (let [filter, result] in tests)
    asyncTest(filter, runTest.bind(null, Filter.fromText(filter), result));
})();
