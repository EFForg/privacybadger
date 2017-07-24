(function(){
  QUnit.module("multiDomainFirstParties.js");

  let mdfp = require('multiDomainFP');

  QUnit.test('isMultiDomainFirstParty test', function (assert) {
    let testData = [['foo.bar', 'yep.com', 'maybe.idk']],
      isMdfp = mdfp.makeIsMultiDomainFirstParty(mdfp.makeDomainLookup(testData));

    assert.ok(isMdfp('yep.com', 'maybe.idk') === true);
    assert.ok(isMdfp('yep.com', 'google.com') === false);
    assert.ok(isMdfp('reddit.com', 'eff.org') === false);
  });
})();
