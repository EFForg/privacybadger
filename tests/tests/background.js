/* globals badger:false */
(function() {
  module("Privacy Badger background tests");
  asyncTest("DNT policy checking works", function(){
    expect(1);
    badger.checkForDNTPolicy('eff.org', 0, function(successStatus) {
      ok(successStatus, "eff.org has a good DNT policy");
      start();
    });
  });
})();
