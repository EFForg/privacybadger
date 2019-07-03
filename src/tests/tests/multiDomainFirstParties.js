(function () {

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

// "lint" our MDFP definitions to avoid accidentally adding PSL domains
// for example:
// https://github.com/EFForg/privacybadger/pull/1550#pullrequestreview-54480652
QUnit.test('MDFP domains are all base domains', (assert) => {
  for (let group of mdfp.multiDomainFirstPartiesArray) {
    for (let domain of group) {
      assert.ok(
        window.getBaseDomain('fakesubdomain.' + domain) == domain,
        domain + ' is a base domain (eTLD+1)'
      );
    }
  }
});

}());
