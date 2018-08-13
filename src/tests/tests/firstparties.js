(function() {
  let destination = 'https://the.beach/';
  let tco = 'http://t.co/beach-detour/';
  let fb_wrap = 'https://facebook.com/l.php?u=' + destination;
  let fb_xss = 'https://facebook.com/l.php?u=javascript://bad.site/%250Aalert(1)';

  function makeLink(href) {
    let element = document.createElement('a');
    element.href = href;
    element.rel = '';
    return element;
  }

  function makeTweet(destURL) {
    let element = document.createElement('div');
    element.href = tco;
    element.rel = '';
    element.setAttribute(destURL, destination);
    return element;
  }

  function addClickListener(element) {
    element.setAttribute('heardClick', 'no');
    element.addEventListener('click', function () {
      element.setAttribute('heardClick', 'yes');
    });
    return element;
  }

  function stub(elts, selector) {
    document.querySelectorAllBefore = document.querySelectorAll;
    window.setIntervalBefore = window.setInterval;

    document.querySelectorAll = function (query) {
      if (query.includes(selector)) {
        return elts;
      } else {
        return document.querySelectorAllBefore(query);
      }
    };
    window.setInterval = function () {};

  }

  function unstub() {
    document.querySelectorAll = document.querySelectorAllBefore;
    window.setInterval = window.setIntervalBefore;
  }

  QUnit.module('First parties');

  QUnit.test('twitter', (assert) => {
    let attribute = 'data-expanded-url';
    const NUM_CHECKS = 1,
      done = assert.async();
    assert.expect(NUM_CHECKS);

    let fixture = document.getElementById('qunit-fixture');
    addClickListener(fixture);
    let tweet = makeTweet(attribute);

    // load the content script
    let script = document.createElement('script');
    script.src = '../js/firstparties/twitter.js';
    script.onload = function() {
      tweet.click();

      assert.ok(
        (tweet.href == destination) && // replaced the link
        (fixture.getAttribute('heardClick') == 'no') && // twitter didn't hear the click
        (tweet.rel.includes('noreferrer') == true) // added noreferrer
      );

      unstub();
      done();
    };

    stub([tweet], attribute);
    fixture.appendChild(tweet);
    fixture.appendChild(script);

  });


  QUnit.test('facebook script unwraps valid links', (assert) => {
    const NUM_CHECKS = 4,
      done = assert.async();
    assert.expect(NUM_CHECKS);

    let fixture = document.getElementById('qunit-fixture');
    let good_link = makeLink(fb_wrap);
    let bad_link = makeLink(fb_xss);

    // load the content script
    let script = document.createElement('script');
    script.src = '../js/firstparties/facebook.js';
    script.onload = function() {
      assert.equal(good_link.href, destination, 'unwrapped good link');
      assert.ok(good_link.rel.includes('noreferrer'),
        'added noreferrer to good link');

      assert.equal(bad_link.href, fb_xss, 'did not unwrap the XSS link');
      assert.notOk(bad_link.rel.includes('noreferrer'),
        'did not change rel of XSS link');

      unstub();
      done();
    };

    stub([good_link, bad_link], '/l.php?');
    fixture.appendChild(good_link);
    fixture.appendChild(bad_link);
    fixture.appendChild(script);
  });

}());
