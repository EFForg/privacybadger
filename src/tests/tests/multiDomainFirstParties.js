(function(){
  QUnit.module("Multi-domain first parties");

  let mdfp = require('multiDomainFP');

  QUnit.test('isMultiDomainFirstParty test', function (assert) {
    let testData = [
      ['foo.bar', 'yep.com', 'maybe.idk'],
      ['related.com', 'larry.com'],
    ];

    let isMdfp = mdfp.makeIsMultiDomainFirstParty(mdfp.makeDomainLookup(testData));

    assert.ok(
      isMdfp('yep.com', 'maybe.idk'),
      "these are related domains according to test data"
    );
    assert.ok(
      isMdfp('maybe.idk', 'yep.com'),
      "the domains are related regardless of ordering"
    );
    assert.ok(
      isMdfp('related.com', 'larry.com'),
      "these should also be related domains, from a different set in test data"
    );
    assert.notOk(
      isMdfp('yep.com', 'related.com'),
      "these domains are both present in test data but should not be related"
    );
    assert.notOk(
      isMdfp('larry.com', 'yep.com'),
      "these domains are also both present but should be unrelated"
    );
    assert.notOk(
      isMdfp('yep.com', 'google.com'),
      "one of these domains is not in test data"
    );
    assert.notOk(
      isMdfp('reddit.com', 'eff.org'),
      "both domains are not in test data"
    );
  });

  QUnit.test('Check MDFP real domains are all base domains', (assert) => {
    for (var group of mdfp.multiDomainFirstPartiesArray) {
      for (var domain of group) {
        assert.ok(
          window.getBaseDomain('fakesubdomain.' + domain) == domain,
          domain + ' is a basedomain'
        );
      }
    }
  });
})();
