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

  QUnit.test('Test dynamic TLDs', assert => {
    let testData = [
      [['amazon', mdfp.genCcNode], ['amazon', mdfp.genCcNode /* ignored bc already set*/, mdfp.ccNode]],
      [['reddit', mdfp.genCcNode], 'redditstatic.com'],
    ];

    let isMdfp = mdfp.makeIsMultiDomainFirstParty(mdfp.makeDomainLookup(testData));
    assert.ok(isMdfp('amazon.co.uk', 'amazon.com'));
    assert.ok(isMdfp('amazon.com', 'amazon.com.br'));
    assert.notOk(isMdfp('amazon.fake.com', 'amazon.com'));

    assert.ok(isMdfp('reddit.com', 'reddit.br'));
    assert.ok(isMdfp('reddit.com', 'redditstatic.com'));

    assert.notOk(isMdfp('reddit.com', 'amazon.com'));
  });

  QUnit.test('Test real data', assert => {
    assert.ok(mdfp.isMultiDomainFirstParty('tripadvisor.com', 'tacdn.com'));
    assert.ok(mdfp.isMultiDomainFirstParty('tripadvisor.co.uk', 'tamgrt.com'));
    assert.ok(mdfp.isMultiDomainFirstParty('kayak.com.au', 'r9cdn.net'));
  });
})();
