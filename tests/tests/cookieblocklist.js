var Utils           = require('utils').Utils;
var CookieBlockList = require('cookieblocklist').CookieBlockList;
var cookieBlockList;

module('Cookie Block List', {
  setup: function() {
    cookieBlockList = QUnit.extend(CookieBlockList, {
      domains: {}
    });
  }
});

test('`addDomain` correctly adds a domain to the `domains` property.', function() {
  expect(2);

  var noDomains       = {};
  var expectedDomains = {'com': true};

  deepEqual(cookieBlockList.domains, noDomains, '`domains` does not contain a domain.');

  cookieBlockList.addDomain('com');

  deepEqual(cookieBlockList.domains, expectedDomains, '`domains` contains a domain.');
});

test('`removeDomain` removes a given domain', function() {
  expect(2);
  var expectedDomains = {'net':true};
  var noDomains  = {};

  cookieBlockList.addDomain('net');
  deepEqual(cookieBlockList.domains, expectedDomains, '`cookieBlockList` conatins domains.');

  cookieBlockList.removeDomain('net');
  deepEqual(cookieBlockList.domains, noDomains, '`cookieBlockList` does not contain a domain.');
});

test('`hasDomain` returns `false` if a given domain is not found.', function() {
  expect(1);

  cookieBlockList.addDomain('net');
  var invalidDomain = cookieBlockList.hasDomain('com');

  ok(!invalidDomain, 'cookieBlockList does not contain this domain.');
});
