(function () {

let destination = 'https://the.beach/';
let tco = 'http://t.co/beach-detour/';
let fb_wrap = 'https://facebook.com/l.php?u=' + destination;
let fb_xss = 'https://facebook.com/l.php?u=javascript://bad.site/%250Aalert(1)';
let g_wrap = 'https://www.google.com/url?q=' + destination;
let g_ping = '/url?url=' + destination;

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
  chrome.runtime.sendMessageBefore = chrome.runtime.sendMessage;

  // Stub querySelectorAll so that any selector that includes `selector` will
  // match all the elements in `elts`.
  document.querySelectorAll = function (query) {
    if (query.includes(selector)) {
      return elts;
    } else {
      return document.querySelectorAllBefore(query);
    }
  };

  // Stub runtime.sendMessage so that it returns `true` in response to the
  // `checkEnabled` query.
  chrome.runtime.sendMessage = function (message, callback) {
    if (message.checkEnabled) {
      callback(true);
    } else {
      chrome.runtime.sendMessageBefore(message, callback);
    }
  };
  window.setInterval = function () {};

}

function unstub() {
  document.querySelectorAll = document.querySelectorAllBefore;
  window.setInterval = window.setIntervalBefore;
  chrome.runtime.sendMessage = chrome.runtime.sendMessageBefore;
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

  // create first-party utility script
  let util_script = document.createElement('script');
  util_script.src = '../js/firstparties/lib/utils.js';

  // create the content script
  let fb_script = document.createElement('script');
  fb_script.src = '../js/firstparties/facebook.js';
  fb_script.onload = function() {
    assert.equal(good_link.href, destination, 'unwrapped good link');
    assert.ok(good_link.rel.includes('noreferrer'),
      'added noreferrer to good link');

    assert.equal(bad_link.href, fb_xss, 'did not unwrap the XSS link');
    assert.notOk(bad_link.rel.includes('noreferrer'),
      'did not change rel of XSS link');

    unstub();
    done();
  };

  // after the utility script has finished loading, add the content script
  util_script.onload = function() {
    fixture.append(fb_script);
  };

  stub([good_link, bad_link], '/l.php?');
  fixture.appendChild(good_link);
  fixture.appendChild(bad_link);
  fixture.appendChild(util_script);
});


QUnit.test('google shim link unwrapping', (assert) => {
  const NUM_CHECKS = 2,
    done = assert.async();
  assert.expect(NUM_CHECKS);

  let fixture = document.getElementById('qunit-fixture');
  let shim_link = makeLink(g_wrap);

  // create first-party utility script
  let util_script = document.createElement('script');
  util_script.src = '../js/firstparties/lib/utils.js';

  // create the content script
  let g_script = document.createElement('script');
  g_script.src = '../js/firstparties/google-static.js';
  g_script.onload = function() {
    assert.equal(shim_link.href, destination, 'unwrapped shim link');
    assert.ok(shim_link.rel.includes('noreferrer'),
      'added noreferrer to shim link');

    unstub();
    done();
  };

  // after the utility script has finished loading, add the content script
  util_script.onload = function() {
    fixture.append(g_script);
  };

  stub([shim_link], '/url?');
  fixture.appendChild(shim_link);
  fixture.appendChild(util_script);
});


QUnit.test('google search de-instrumentation', (assert) => {
  const NUM_CHECKS = 3,
    done = assert.async();
  assert.expect(NUM_CHECKS);

  let fixture = document.getElementById('qunit-fixture');
  let ff_link = makeLink(destination);
  ff_link.onmousedown = 'return rwt(this, foobar);';
  let chrome_link = makeLink(destination);
  chrome_link.ping = g_ping;

  // create first-party utility script
  let util_script = document.createElement('script');
  util_script.src = '../js/firstparties/lib/utils.js';

  // create the content script
  let g_script = document.createElement('script');
  g_script.src = '../js/firstparties/google-search.js';
  g_script.onload = function() {
    assert.notOk(ff_link.onmousedown, 'removed mouseDown event from ff link');
    assert.ok(ff_link.rel.includes('noreferrer'), 'added noreferrer to link');

    assert.notOk(chrome_link.ping, 'removed ping attr from chrome link');

    unstub();
    done();
  };

  // after the utility script has finished loading, add the content script
  util_script.onload = function() {
    fixture.append(g_script);
  };

  stub([ff_link, chrome_link], 'onmousedown^=');
  fixture.appendChild(ff_link);
  fixture.appendChild(chrome_link);
  fixture.appendChild(util_script);
});

}());
