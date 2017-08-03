(function(){
  QUnit.module("multiDomainFirstParties.js");

  let mdfp = require('multiDomainFP');

  QUnit.test('isMultiDomainFirstParty test', function (assert) {
    let testData = [['foo.bar', 'yep.com', 'maybe.idk'], ['related.com', 'larry.com']],
      isMdfp = mdfp.makeIsMultiDomainFirstParty(mdfp.makeDomainLookup(testData));

    assert.ok(isMdfp('yep.com', 'maybe.idk'));
    assert.notOk(isMdfp('yep.com', 'google.com'));
    assert.notOk(isMdfp('reddit.com', 'eff.org'));
    assert.notOk(isMdfp('larry.com', 'yep.com'));
  });
})();
