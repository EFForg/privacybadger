(function() {
  QUnit.module("HTML Utils");

  var htmlUtils = require("htmlutils").htmlUtils;

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

  QUnit.test("getActionDescription", (assert) => {
    // Test parameters
    const getMessage = chrome.i18n.getMessage,
      origin = "pbtest.org";
    const tests = [
      {
        action: "block",
        origin,
        expectedResult: getMessage('badger_status_block') + origin,
      },
      {
        action: "cookieblock",
        origin,
        expectedResult: getMessage('badger_status_cookieblock') + origin,
      },
      {
        action: "allow",
        origin,
        expectedResult: getMessage('badger_status_allow') + origin,
      },
    ];

    // Run each test.
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i],
        message = `Inputs: '${test.action}' and '${test.origin}'`;

      assert.equal(
        htmlUtils.getActionDescription(test.action, test.origin),
        test.expectedResult,
        message
      );
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

  QUnit.test("getOriginHtml", function (assert) {
    // Test parameters
    var tests = [
      {
        existingHtml: '<div id="existinghtml"></div>',
        origin: "pbtest.org",
        action: "allow",
        isWhitelisted: false,
      },
      {
        existingHtml: '<div id="existinghtml"></div>',
        origin: "pbtest.org",
        action: "block",
        isWhitelisted: true,
      },
    ];

    // Run each test.
    for (var i = 0; i < tests.length; i++) {
      var existingHtml = tests[i].existingHtml;
      var origin = tests[i].origin;
      var action = tests[i].action;
      var isWhitelisted = tests[i].isWhitelisted;

      var htmlResult = existingHtml + htmlUtils.getOriginHtml(
        origin, action, isWhitelisted);

      // Make sure existing HTML is present.
      var existingHtmlExists = htmlResult.indexOf(existingHtml) > -1;
      assert.ok(existingHtmlExists, "Existing HTML should be present");

      // Make sure origin is set.
      var originDataExists = htmlResult.indexOf('data-origin="' + origin + '"') > -1;
      assert.ok(originDataExists, "Origin should be set");

      // Check for presence of DNT content.
      var dntExists = htmlResult.indexOf('id="dnt-compliant"') > -1;
      assert.equal(dntExists, isWhitelisted,
        "DNT div should " + ((dntExists) ? "" : "not ") + "be present");
    }
  });

})();
