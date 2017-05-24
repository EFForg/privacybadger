(function() {
  QUnit.module("First parties");

  QUnit.test("test twitter content script", (assert) => {
    const NUM_TESTS = 2,
      done = assert.async(NUM_TESTS);
    assert.expect(NUM_TESTS);

    // mock out twitter's click listener
    let qf = document.getElementById("qunit-fixture");
    qf.setAttribute("twitterHeardClick", "no");
    qf.addEventListener("click", function () {
      qf.setAttribute("twitterHeardClick", "yes");
    });

    // create a tweet element like we'd get from twitter
    let tco = "http://t.co/beach-detour/";
    let destination = "https://the.beach/";
    let el = document.createElement("div");
    el.href = tco;
    el.setAttribute("data-expanded-url", destination);

    const selector = sinon.stub(document, "querySelectorAll");
    selector.returns([el]);
    qf.appendChild(el);

    // load the content script
    let script = document.createElement("script");
    script.src = "../js/first_parties/twitter.js";
    script.onload = function () {
      el.click();
      assert.equal(el.href, destination, "we replaced the link");
      assert.equal(qf.getAttribute("twitterHeardClick"), "no", "twitter didn't hear our click");

      selector.restore();
      done();
    };
    qf.appendChild(script);

  });
}());
