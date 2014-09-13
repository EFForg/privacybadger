var Utils           = require('utils').Utils;
var DomainExceptions = require('domainExceptions').DomainExceptions;
var domainExceptions;

module('Domain Exceptions', {
  setup: function() {
    domainExceptions = QUnit.extend(DomainExceptions, {
      list: {},
      domainExceptionListURL: chrome.extension.getURL('doc/sample_domain_exception_list.json')
    });
  }
});

asyncTest("list is valid", function(){
  expect(3);
  domainExceptions.updateList(function(){
    ok(typeof domainExceptions.list === 'object', "domain exception list is an object");
    ok(domainExceptions.list != {}, "Domain exception list is not empty");
    var count = 0;
    for(domain in domainExceptions.list){
      count += 1;
    };
    ok(count >= 1, 'There is atleast 1 domain in the list');
    start();
  });
});
