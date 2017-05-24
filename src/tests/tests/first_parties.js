(function() {
  QUnit.test("test twitter content script", (assert) => {
    const NUM_CHECKS = 1;
    let done = assert.async(NUM_CHECKS);

    // create element as we'd get it from twitter
    let tco = "http://t.co/beach-detour/";
    let destination = "https://the.beach/";
    let el = document.createElement("div");
    el.setAttribute("href", tco);
    el.setAttribute("data-expanded-url", destination);
    document.querySelectorAll = function () {
      return [el];
    };

    // load the content script
    let script = document.createElement("script");
    script.src = "../js/first_parties/twitter.js";
    script.onload = function () {
      unwrapTwitterURLs();

      // check we unwrapped it
      assert.equal(el.href, destination);
      done();
    };

    let qf = document.getElementById("qunit-fixture");
    qf.appendChild(script);
    qf.remove();

  });
}());
