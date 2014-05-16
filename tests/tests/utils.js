(function() {
  module("Privacy Badger Utils");

  var Utils = require('utils').Utils;

  test("removeElementFromArray", function(){
    var testAry = [1,2,3,4,5,6];
    Utils.removeElementFromArray(testAry,2);
    ok(testAry.length === 5, "Array length is 5");
    ok(testAry.indexOf(3) === -1, "second element has been deleted");
    ok(testAry[2] === 4);
  });

  test("removeElementsFromArray", function(){
    var testAry = [1,2,3,4,5,6];
    Utils.removeElementFromArray(testAry,2, 4);
    ok(testAry.length === 3, "Array length is 3");
    ok(testAry.indexOf(3) === -1, "second element deleted");
    ok(testAry.indexOf(4) === -1, "third element deleted");
    ok(testAry.indexOf(5) === -1, "fourth element deleted");
    ok(testAry[2] === 6, "correct value at idx 2");
  });

  asyncTest("send xhrRequest", function(){
    expect(2); //expect 1 assertion
    Utils.xhrRequest("https://eff.org", function(err,resp){
      ok(true, "xhr calls callback");
      ok(err === null, "there was no error");
      start();
    });
  });


})();
