(function()
{
  let server = null;
  let frame = null;
  let requestNotifier = null;

  module("Content policy", {
    setup: function()
    {
      prepareFilterComponents.call(this);
      preparePrefs.call(this);

      server = new nsHttpServer();
      server.start(1234);

      frame = document.createElement("iframe");
      frame.style.visibility = "collapse";
      document.body.appendChild(frame);

      requestNotifier = new RequestNotifier(window, onPolicyHit);
    },
    teardown: function()
    {
      restoreFilterComponents.call(this);
      restorePrefs.call(this);

      stop();
      server.stop(function()
      {
        frame.parentElement.removeChild(frame);
        requestNotifier.shutdown();

        server = null;
        frame = null;
        requestNotifier = null;

        start();
      });
    }
  });

  let tests = [
    [
      "HTML image with relative URL",
      '<img src="test.gif">',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "HTML image with absolute URL",
      '<img src="http://localhost:1234/test.gif">',
      "http://localhost:1234/test.gif", "image", "127.0.0.1", true
    ],
    [
      "HTML image button",
      '<input type="image" src="test.gif">',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "HTML image button inside a frame",
      '<iframe src="data:text/html,%3Cinput%20type%3D%22image%22%20src%3D%22http%3A%2F%2F127.0.0.1:1234%2Ftest.gif%22%3E"></iframe>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "HTML image button inside a nested frame",
      '<iframe src="data:text/html,%3Ciframe%20src%3D%22data%3Atext%2Fhtml%2C%253Cinput%2520type%253D%2522image%2522%2520src%253D%2522http%253A%252F%252F127.0.0.1%3A1234%252Ftest.gif%2522%253E%22%3E%3C%2Fiframe%3E"></iframe>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "Dynamically inserted image button",
      '<iframe src="about:blank"></iframe><script>window.addEventListener("DOMContentLoaded", function() {frames[0].document.body.innerHTML = \'<input type="image" src="test.gif">\';}, false);<' + '/script>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "CSS background-image",
      '<div style="background-image: url(test.gif)"></div>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "CSS cursor",
      '<div style="cursor: url(test.gif), pointer"></div>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "CSS list-style-image",
      '<ol>' +
        '<li style="list-style-image: url(test.gif)">foo</li>' +
      '</ol>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "CSS generated content",
      '<style>div:before { content: url(test.gif); }</style><div>foo</div>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "HTML embed (image)",
      '<embed type="image/gif" src="test.gif"></embed>',
      "http://127.0.0.1:1234/test.gif", "object", "127.0.0.1", false
    ],
    [
      "HTML object (image)",
      '<object type="image/gif" data="test.gif"></object>',
      "http://127.0.0.1:1234/test.gif", "object", "127.0.0.1", false
    ],
    [
      "SVG image",
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<image xlink:href="test.gif"/>' +
      '</svg>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "SVG filter image",
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<filter>' +
          '<feImage xlink:href="test.gif"/>' +
        '</filter>' +
      '</svg>',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "HTML script",
      '<script src="test.js"></script>',
      "http://127.0.0.1:1234/test.js", "script", "127.0.0.1", false
    ],
    [
      "SVG script",
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<script xlink:href="test.js"/>' +
      '</svg>',
      "http://127.0.0.1:1234/test.js", "script", "127.0.0.1", false
    ],
    [
      "HTML stylesheet",
      '<link rel="stylesheet" type="text/css" href="test.css">',
      "http://127.0.0.1:1234/test.css", "stylesheet", "127.0.0.1", false
    ],
    [
      "HTML image with redirect",
      '<img src="redirect.gif">',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "HTML image with multiple redirects",
      '<img src="redirect2.gif">',
      "http://127.0.0.1:1234/test.gif", "image", "127.0.0.1", false
    ],
    [
      "CSS fonts",
      '<style type="text/css">@font-face { font-family: Test; src: url("test.otf"); } html { font-family: Test; }</style>',
      "http://127.0.0.1:1234/test.otf", "font", "127.0.0.1", false
    ],
    [
      "XMLHttpRequest loading",
      '<script>var request = new XMLHttpRequest();request.open("GET", "test.xml", false);request.send(null);</script>',
      "http://127.0.0.1:1234/test.xml", "xmlhttprequest", "127.0.0.1", false
    ],
    [
      "XML document loading",
      '<script>var xmlDoc = document.implementation.createDocument(null, "root", null);xmlDoc.async = false;xmlDoc.load("test.xml")</script>',
      "http://127.0.0.1:1234/test.xml", "xmlhttprequest", "127.0.0.1", false
    ],
    [
      "Web worker",
      '<script>new Worker("test.js");</script>' +
        '<script>var r = new XMLHttpRequest();r.open("GET", "", false);r.send(null);</script>',
      "http://127.0.0.1:1234/test.js", "script", "127.0.0.1", false
    ],
  ];

  if (window.navigator.mimeTypes["application/x-shockwave-flash"] && window.navigator.mimeTypes["application/x-shockwave-flash"].enabledPlugin)
  {
    tests.push([
      "HTML embed (Flash)",
      '<embed type="application/x-shockwave-flash" src="test.swf"></embed>' +
        '<script>var r = new XMLHttpRequest();r.open("GET", "", false);r.send(null);</script>',
      "http://127.0.0.1:1234/test.swf", "object", "127.0.0.1", false
    ],
    [
      "HTML object (Flash)",
      '<object type="application/x-shockwave-flash" data="test.swf"></object>' +
        '<script>var r = new XMLHttpRequest();r.open("GET", "", false);r.send(null);</script>',
      "http://127.0.0.1:1234/test.swf", "object", "127.0.0.1", false
    ]);
  }

  if (window.navigator.mimeTypes["application/x-java-applet"] && window.navigator.mimeTypes["application/x-java-applet"].enabledPlugin)
  {
    // Note: this could use some improvement but Gecko will fail badly with more complicated tests (bug 364400)
    // Note: <applet> is not on the list because it shows some weird async behavior (data is loaded after page load in some strange way)
    tests.push([
      "HTML embed (Java)",
      '<embed type="application/x-java-applet" code="test.class" src="test.class"></embed>',
      "http://127.0.0.1:1234/test.class", "object", "127.0.0.1", false
    ],
    [
      "HTML object (Java)",
      '<object type="application/x-java-applet" data="test.class"></object>',
      "http://127.0.0.1:1234/test.class", "object", "127.0.0.1", false
    ]);
  }

  let policyHits = [];
  function onPolicyHit(wnd, node, item, scanComplete)
  {
    if (item.location == "http://127.0.0.1:1234/test" ||
        item.location == "http://127.0.0.1:1234/redirect.gif" ||
        item.location == "http://127.0.0.1:1234/redirect2.gif")
    {
      return;
    }
    if (item.filter instanceof WhitelistFilter)
      return;

    if (policyHits.length > 0)
    {
      // Ignore duplicate policy calls (possible due to prefetching)
      let [prevWnd, prevNode, prevItem] = policyHits[policyHits.length - 1];
      if (prevWnd == wnd && prevItem.location == item.location && prevItem.type == item.type &&  prevItem.docDomain == item.docDomain)
        policyHits.pop();
    }
    policyHits.push([wnd, node, item]);
  }

  function runTest([name, body, expectedURL, expectedType, expectedDomain, expectedThirdParty], stage)
  {
    defaultMatcher.clear();

    if (stage > 1)
      defaultMatcher.add(Filter.fromText(expectedURL));
    if (stage == 3)
      defaultMatcher.add(Filter.fromText("@@||127.0.0.1:1234/test|$document"));
    if (stage == 4)
      defaultMatcher.add(Filter.fromText("@@||127.0.0.1:1234/test|$~document"));

    let serverHit = false;
    server.registerPathHandler("/test", function(metadata, response)
    {
      response.setStatusLine("1.1", "200", "OK");

      let contentType = "text/html";
      if (body.indexOf("2000/svg") >= 0)
        contentType = "image/svg+xml";
      response.setHeader("Content-Type", contentType + "; charset=utf-8");

      response.bodyOutputStream.write(body, body.length);
    });
    server.registerPathHandler("/redirect.gif", function(metadata, response)
    {
      response.setStatusLine("1.1", "302", "Moved Temporarily");
      response.setHeader("Location", "http://127.0.0.1:1234/test.gif");
    });
    server.registerPathHandler("/redirect2.gif", function(metadata, response)
    {
      response.setStatusLine("1.1", "302", "Moved Temporarily");
      response.setHeader("Location", "http://127.0.0.1:1234/redirect.gif");
    });
    server.registerPathHandler(expectedURL.replace(/http:\/\/[^\/]+/, ""), function(metadata, response)
    {
      serverHit = true;
      response.setStatusLine("1.1", "404", "Not Found");
    });

    policyHits = [];
    frame.onload = function()
    {
      let expectedStatus = "allowed";
      if (stage == 3)
        equal(policyHits.length, 0, "Number of policy hits");
      else
      {
        equal(policyHits.length, 1, "Number of policy hits");
        if (policyHits.length == 1)
        {
          let [wnd, node, item] = policyHits[0];

          equal(item.location, expectedURL, "Request URL");

          expectedStatus = (stage == 1 ? "allowed" : "blocked");
          let actualStatus = (item.filter ? "blocked" : "allowed");

          equal(actualStatus, expectedStatus, "Request blocked");
          equal(item.typeDescr.toLowerCase(), expectedType, "Request type");
          equal(item.thirdParty, expectedThirdParty, "Third-party flag");
          equal(item.docDomain, expectedDomain, "Document domain");
        }
      }

      server.registerPathHandler(expectedURL.replace(/http:\/\/[^\/]+/, ""), null);
      equal(serverHit, expectedStatus == "allowed", "Request received by server");

      start();
    };
    frame.contentWindow.location.href = "http://127.0.0.1:1234/test";
  }

  let stageDescriptions = {
    1: "running without filters",
    2: "running with filter %S",
    3: "running with filter %S and site exception",
    4: "running with filter %S and exception not applicable to sites",
  };

  for (let test = 0; test < tests.length; test++)
  {
    let [name, body, expectedURL, expectedType, expectedDomain, expectedThirdParty] = tests[test];
    for (let stage = 1; stage in stageDescriptions; stage++)
    {
      let stageDescription = stageDescriptions[stage];
      if (stageDescription.indexOf("%S") >= 0)
        stageDescription = stageDescription.replace("%S", expectedURL);

      asyncTest(name + " (" + stageDescription + ")", runTest.bind(null, tests[test], stage));
    }
  }
})();
