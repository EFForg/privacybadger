(function() {
  let tco = 'http://t.co/beach-detour/';
  let destination = 'https://the.beach/';

  document.querySelectorAllBefore = document.querySelectorAll;
  function stub(tweet) {
    document.querySelectorAll = function (query) {
      if (query.includes('data-expanded-url')) {
        return [tweet];
      } else {
        return document.querySelectorAllBefore(query);
      }
    }
  }
  function unstub() {
    document.querySelectorAll = document.querySelectorAllBefore;
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

  QUnit.module('First parties');

  QUnit.test('twitter', (assert) => {
    let attribute = 'data-expanded-url';
    const NUM_CHECKS = 1,
      done = assert.async();
    assert.expect(NUM_CHECKS);

    let fixture = document.getElementById('qunit-fixture');
    addClickListener(fixture);
    let tweet = makeTweet(attribute);

    // set the config for twitter.js
    window.config = {'queryParam': attribute};

    // load the content script
    let script = document.createElement('script');
    script.src = '../js/firstparties/twitter.js';
    script.onload = function() {
      tweet.click();

      assert.ok(
        (tweet.href == destination) &&  // replaced the link
        (fixture.getAttribute('heardClick') == 'no') &&  // twitter didn't hear the click
        (tweet.rel.includes('noreferrer') == true) // added noreferrer
      );

      unstub();
      done();
    };

    stub(tweet);
    fixture.appendChild(tweet);
    fixture.appendChild(script);

  });
}());
