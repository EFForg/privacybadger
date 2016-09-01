(function() {
  module("Privacy Badger Utils");

  var utils = require('utils');
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
    ok(pb.isPrivacyBadgerEnabled("eff.org"), "enabled for site");

    pb.disablePrivacyBadgerForOrigin("example.com");
    ok(!pb.isPrivacyBadgerEnabled("example.com"), "disabled for site");
    pb.enablePrivacyBadgerForOrigin("example.com");
    ok(pb.isPrivacyBadgerEnabled("example.com"), "enabled for site");
  });
  
  test("disable/enable privacy badger for origin", function(){
    var parsed = function(){ return pb.storage.getBadgerStorageObject('settings_map').getItem('disabledSites'); };
    var origLength = parsed() && parsed().length || 0;

    pb.disablePrivacyBadgerForOrigin('foo.com');
    ok(parsed().length == (origLength + 1), "one more disabled site");

    pb.enablePrivacyBadgerForOrigin('foo.com');
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
})();
