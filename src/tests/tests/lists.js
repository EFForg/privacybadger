(function() {
  QUnit.module('Test lists');
  let mdfp = require('multiDomainFP');

  QUnit.test('Check MDFP domains are all base domains', (assert) => {
    for (var group of mdfp.multiDomainFirstPartiesArray) {
      for (var domain of group) {
        assert.ok(window.getBaseDomain(domain) == domain, 'is a basedomain');
        assert.notOk(domain in window.publicSuffixes, 'not a public suffix');
      }
    }
  });
})();
