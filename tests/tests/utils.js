/* globals badger:false */

(function() {
  module("Privacy Badger Utils");

  var utils = require('utils');
  var getSurrogateURI = require('surrogates').getSurrogateURI;
  var mdfp = require('multiDomainFP');

  test("removeElementFromArray", function(){
    var testAry = [1,2,3,4,5,6];
    utils.removeElementFromArray(testAry,2);
    ok(testAry.length === 5, "Array length is 5");
    ok(testAry.indexOf(3) === -1, "second element has been deleted");
    ok(testAry[2] === 4);
  });

  test("removeElementsFromArray", function(){
    var testAry = [1,2,3,4,5,6];
    utils.removeElementFromArray(testAry,2, 4);
    ok(testAry.length === 3, "Array length is 3");
    ok(testAry.indexOf(3) === -1, "second element deleted");
    ok(testAry.indexOf(4) === -1, "third element deleted");
    ok(testAry.indexOf(5) === -1, "fourth element deleted");
    ok(testAry[2] === 6, "correct value at idx 2");
  });

  test("explodeSubdomains", function(){
    var fqdn = "test.what.yea.eff.org";
    var subs = utils.explodeSubdomains(fqdn);
    console.log(subs);
    ok(subs.length == 4);
    ok(subs[0] == fqdn);
    ok(subs[3] == 'eff.org');
  });

  asyncTest("send xhrRequest", function(){
    expect(3); //expect 1 assertion
    utils.xhrRequest("https://www.eff.org/files/badgertest.txt", function(err,resp){
      ok(true, "xhr calls callback");
      ok(err === null, "there was no error");
      ok(resp === "test passed\n", "got response text");
      console.log(resp);
      start();
    });
  });

  asyncTest("send faling xhrRequest", function(){
    expect(3); //expect 1 assertion
    utils.xhrRequest("https://www.eff.org/nonexistent-page", function(err/*,resp*/){
      ok(true, "xhr calls callback");
      ok(err, "there was an error");
      ok(err.status === 404, "error was 404");
      start();
    });
  });

  test("isPrivacyBadgerEnabled", function(){
    ok(badger.isPrivacyBadgerEnabled("eff.org"), "enabled for site");

    badger.disablePrivacyBadgerForOrigin("example.com");
    ok(!badger.isPrivacyBadgerEnabled("example.com"), "disabled for site");
    badger.enablePrivacyBadgerForOrigin("example.com");
    ok(badger.isPrivacyBadgerEnabled("example.com"), "enabled for site");
  });
  
  test("disable/enable privacy badger for origin", function(){
    var parsed = function(){ return badger.storage.getBadgerStorageObject('settings_map').getItem('disabledSites'); };
    var origLength = parsed() && parsed().length || 0;

    badger.disablePrivacyBadgerForOrigin('foo.com');
    ok(parsed().length == (origLength + 1), "one more disabled site");

    badger.enablePrivacyBadgerForOrigin('foo.com');
    ok(parsed().length == origLength, "one less disabled site");
  });

  test("getRandom", function(){
    var min = 1,
        max = 10,
        iterations = 1000,
        results = [];

    for(var i = 0; i < iterations; i++){
      results.push(utils.getRandom(min,max));
    }
    ok(Math.max.apply(null,results) === max, "max is max");
    ok(Math.min.apply(null,results) === min, "min is min");
  });

  test("multi domain first party", function(){
    ok(mdfp.isMultiDomainFirstParty("dummy", "dummy"));
    ok(mdfp.isMultiDomainFirstParty("google.com", "youtube.com"));
    ok(!mdfp.isMultiDomainFirstParty("google.com", "nyt.com"));
  });

  test("surrogate script URL lookups", function() {
    const GA_JS_TESTS = [
      {
        url: 'http://www.google-analytics.com/ga.js',
        msg: "Google Analytics ga.js http URL should match"
      },
      {
        url: 'https://www.google-analytics.com/ga.js',
        msg: "Google Analytics ga.js https URL should match"
      },
      {
        url: 'https://www.google-analytics.com/ga.js?foo=bar',
        msg: "Google Analytics ga.js querystring URL should match"
      },
    ];
    let ga_js_surrogate;

    for (let i = 0; i < GA_JS_TESTS.length; i++) {
      ga_js_surrogate = getSurrogateURI(
        GA_JS_TESTS[i].url,
        'www.google-analytics.com'
      );
      ok(ga_js_surrogate, GA_JS_TESTS[i].msg);
    }

    ok(
      ga_js_surrogate.startsWith('data:application/javascript;base64,'),
      "The returned ga.js surrogate is a base64-encoded JavaScript data URI"
    );

    ok(
      !getSurrogateURI(
        'https://a1.nyt.com/assets/homepage/20160920-111441/js/foundation/lib/framework.js',
        'a1.nyt.com'
      ),
      "New York Times script URL should not match any surrogates"
    );
  });
})();
