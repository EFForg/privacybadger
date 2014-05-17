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

  list: [
    'https://apis.google.com/u/0/wm/4/_/widget/render/comments',
    'https://disqus.com/next/login',
    'http://disqus.com/_ax/facebook/begin',
    'http://disqus.com/_ax/google/begin',
  ],
  hasPath: function(path){
    for(var i=0; i < this.list.length; i++){
      if(path.indexOf(this.list[i]) === 0){ return true; }
    }
    return false;
  },

}

exports.DomainExceptions = DomainExceptions;

})();
