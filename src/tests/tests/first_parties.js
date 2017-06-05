(function() {
  let tco = "http://t.co/beach-detour/";
  let destination = "https://the.beach/";

  function makeTweet(destURL) {
    let element = document.createElement("a");
    element.id = 'timeline';
    element.href = tco;
    element.rel = '';
    element.setAttribute(destURL, destination);
    return element;
  }

  function addClickListener(element) {
    element.setAttribute("heardClick", "no");
    element.addEventListener("click", function () {
      element.setAttribute("heardClick", "yes");
    });
    return element;
  }

  QUnit.module("First parties");

  QUnit.test("twitter", (assert) => {
    let attribute = 'data-expanded-url';
    const NUM_CHECKS = 3,
      done = assert.async();
    assert.expect(NUM_CHECKS);

    let fixture = document.getElementById("qunit-fixture");
    addClickListener(fixture);
    let tweet = makeTweet(attribute);

    // set the config for twitter.js
    window.config = {"queryParam": attribute};

    // load the content script
    let script = document.createElement("script");
    script.src = "../js/firstparties/twitter.js";
    script.onload = function() {
      tweet.click();

      assert.equal(tweet.href, destination, "we replaced the link");
      assert.equal(fixture.getAttribute("heardClick"), "no", "twitter didn't hear our click");
      assert.equal(tweet.getAttribute('rel').includes("noreferrer"), true, "we add noreferrer");

      done();
    };

    fixture.appendChild(tweet);
    fixture.appendChild(script);

  });

}());
