(function() {
  QUnit.module("HTML Utils");

  var htmlUtils = require("htmlutils").htmlUtils;

  QUnit.test("trim", function (assert) {
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
      assert.equal(htmlUtils.trim(inputString, maxLength), expected, message);
    }
  });

  QUnit.test("isChecked", function (assert) {
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
      assert.equal(htmlUtils.isChecked(inputAction, originAction), expected, message);
    }
  });

  QUnit.test("getActionDescription", function (assert) {
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
      assert.equal(htmlUtils.getActionDescription(action, origin), expected, message);
    }
  });

  QUnit.test("getToggleHtml", function (assert) {
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
      assert.equal(inputValue, expected, message);
    }
  });

  QUnit.test("getTrackerContainerHtml", function (assert) {
    // Test given tab ID.
    var tabId = 1;
    var htmlResult = htmlUtils.getTrackerContainerHtml(tabId);
    var tabIdExists = htmlResult.indexOf('data-tab-id="' + tabId + '"') > -1;
    assert.ok(tabIdExists, "Given tab ID should be set");

    // Test missing tab ID.
    htmlResult = htmlUtils.getTrackerContainerHtml();
    var defaultTabIdExists = htmlResult.indexOf('data-tab-id="000"') > -1;
    assert.ok(defaultTabIdExists, "Default tab ID should be set");
  });

  QUnit.test("addOriginHtml", function (assert) {
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
      assert.ok(existingHtmlExists, "Existing HTML should be present");

      // Make sure origin and original action are set.
      var originDataExists = htmlResult.indexOf('data-origin="' + origin + '"') > -1;
      assert.ok(originDataExists, "Origin should be set");
      var originalActionExists = htmlResult.indexOf('data-original-action="' + action + '"') > -1;
      assert.ok(originalActionExists, "Original action should be set");

      // Check for presence of subdomain count.
      var countExists = htmlResult.indexOf(subdomainCount + " subdomains") > 0;
      assert.equal(countExists, subdomainCount > 0,
        "Subdomain count should " + ((countExists) ? "": "not ") + "be present");

      // Check for presence of DNT content.
      var dntExists = htmlResult.indexOf('id="dnt-compliant"') > -1;
      assert.equal(dntExists, isWhitelisted,
        "DNT div should " + ((dntExists) ? "" : "not ") + "be present");
    }
  });

})();
