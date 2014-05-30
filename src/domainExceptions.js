/**
* This is a dictionary containing all of the domains that user may want to 
* make an exception for. The key is the domain that will need to be allowed and
* the value is an array of the acceptable 1st party domains to show this popup
* on. If the array is empty then we show the popup for any request to the 
* domain 
**/
require.scopes["domainExceptions"] = (function() {
  
var exports = {};

var DomainExceptions = {

  list: {
    "google.com": {
      trigger_urls: ['https://plus.google.com/u/0/wm/4/_/+1/messageproxy'],
      whitelist_domain: 'apis.google.com'
    },
    "disqus.com": {
      trigger_urls: [
        'https://disqus.com/next/login',
        'http://disqus.com/_ax/facebook/begin',
        'http://disqus.com/_ax/google/begin'
      ],
      whitelist_domain: 'disqus.com'
    }
  },
  getWhitelistForPath: function(path){
    for(var name in this.list){
      var trigger_urls = this.list[name].trigger_urls;
      for(var i = 0; i < trigger_urls.length; i++){
        if(path.indexOf(trigger_urls[i]) === 0){ return this.list[name].whitelist_domain }
      }
    }
    return undefined;
  },

}

exports.DomainExceptions = DomainExceptions;
return exports;
})();
