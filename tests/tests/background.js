/* globals badger:false */
(function() {
  module("Privacy Badger background tests");
  asyncTest("DNT policy checking works", function(){
    expect(1);
    badger.checkPrivacyBadgerPolicy('eff.org', function(successStatus) {
      ok(successStatus === true, "eff.org has a good DNT policy");
      start();
    });
  });
})();
