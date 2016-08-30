(function() {
  module("Privacy Badger HTML Utils");

  var htmlUtils = require("htmlutils").htmlUtils;

  test("trim", function() {
    // Test parameters
    var tests = [
      {
        inputString: "This is a test",
        maxLength: 30,
        expectedResult: "This is a test",
      },
      {
        inputString: "This is a test",
        maxLength: 10,
        expectedResult: "This is...",
      },
    ];

    // Run each test.
    for (var i = 0; i < tests.length; i++) {
      var inputString = tests[i].inputString;
      var maxLength = tests[i].maxLength;
      var expected = tests[i].expectedResult;
      var message = "Inputs: '" + inputString + "' and " + maxLength;
      equal(htmlUtils.trim(inputString, maxLength), expected, message);
    }
  });

  test("isChecked", function() {
    // Test parameters
    var tests = [
      {
        inputAction: "allow",
        originAction: "allow",
        expectedResult: "checked",
      },
      {
        inputAction: "allow",
        originAction: "block",
        expectedResult: "",
      },
    ];

    // Run each test.
    for (var i = 0; i < tests.length; i++) {
      var inputAction = tests[i].inputAction;
      var originAction = tests[i].originAction;
      var expected = tests[i].expectedResult;
      var message = "Inputs: '" + inputAction + "' and '" + originAction + "'";
      equal(htmlUtils.isChecked(inputAction, originAction), expected, message);
    }
  });

  test("getActionDescription", function() {
    // Test parameters
    var tests = [
      {
        action: "block",
        origin: "pbtest.org",
        expectedResult: "Blocked pbtest.org",
      },
      {
        action: "cookieblock",
        origin: "pbtest.org",
        expectedResult: "Blocked cookies from pbtest.org",
      },
      {
        action: "allow",
        origin: "pbtest.org",
        expectedResult: "Allowed pbtest.org",
      },
    ];

    // Run each test.
    for (var i = 0; i < tests.length; i++) {
      var action = tests[i].action;
      var origin = tests[i].origin;
      var expected = tests[i].expectedResult;
      var message = "Inputs: '" + action + "' and '" + origin + "'";
      equal(htmlUtils.getActionDescription(action, origin), expected, message);
    }
  });

  test("getToggleHtml", function() {
    // Test parameters
    var tests = [
      {
        origin: "pbtest.org",
        action: "block",
        expectedResult: "0",
      },
      {
        origin: "pbtest.org",
        action: "cookieblock",
        expectedResult: "1",
      },
      {
        origin: "pbtest.org",
        action: "allow",
        expectedResult: "2",
      },
    ];

    // Run each test.
    for (var i = 0; i < tests.length; i++) {
      var origin = tests[i].origin;
      var action = tests[i].action;
      var expected = tests[i].expectedResult;
      var message = "Inputs: '" + origin + "' and '" + action + "'";
      var html = htmlUtils.getToggleHtml(origin, action);
      var inputValue = $('input[name="' + origin + '"]:checked', html).val();
      equal(inputValue, expected, message);
    }
  });

  test("addOriginHtml", function() {
    // Test parameters
    var tests = [
      {
        existingHtml: '<div id="existinghtml"></div>',
        origin: "pbtest.org",
        action: "allow",
        isWhitelisted: false,
        subdomainCount: 3,
      },
      {
        existingHtml: '<div id="existinghtml"></div>',
        origin: "pbtest.org",
        action: "block",
        isWhitelisted: true,
        subdomainCount: 0,
      },
    ];

    // Run each test.
    for (var i = 0; i < tests.length; i++) {
      var existingHtml = tests[i].existingHtml;
      var origin = tests[i].origin;
      var action = tests[i].action;
      var isWhitelisted = tests[i].isWhitelisted;
      var subdomainCount = tests[i].subdomainCount;

      var htmlResult = htmlUtils.addOriginHtml(
        existingHtml, origin, action, isWhitelisted, subdomainCount);

      // Make sure existing HTML is present.
      var existingHtmlExists = htmlResult.indexOf(existingHtml) > -1;
      ok(existingHtmlExists, "Existing HTML should be present");

      // Make sure origin and original action are set.
      var originDataExists = htmlResult.indexOf('data-origin="' + origin + '"') > -1;
      ok(originDataExists, "Origin should be set");
      var originalActionExists = htmlResult.indexOf('data-original-action="' + action + '"') > -1;
      ok(originalActionExists, "Original action should be set");

      // Check for presence of subdomain count.
      var countExists = htmlResult.indexOf(subdomainCount + " subdomains") > 0;
      equal(countExists, subdomainCount > 0,
        "Subdomain count should " + ((countExists) ? "": "not ") + "be present");

      // Check for presence of DNT content.
      var dntExists = htmlResult.indexOf('id="dnt-compliant"') > -1;
      equal(dntExists, isWhitelisted,
        "DNT div should " + ((dntExists) ? "" : "not ") + "be present");
    }
  });

})();
