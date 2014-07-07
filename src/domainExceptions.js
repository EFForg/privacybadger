/**
* This is a dictionary containing all of the domains that user may want to 
* make an exception for. The key is the url to trigger a popup and
* the value is an array where index 0 is the domain to whitelist if the user wishes to login.
* Index 1 is the English name of the service.
**/
require.scopes["domainExceptions"] = (function() {
  
var exports = {};

var DomainExceptions = {

  list: {
      /* "trigger_url": ["url to whitelist", "English Name"] */
      //youtube comments
      'https://plus.google.com/u/0/wm/4/_/+1/messageproxy': ["apis.google.com", "Google Plus"],
      
      //disqus
      'https://disqus.com/next/login': ["disqus.com", "Disqus"],
      'http://disqus.com/_ax/facebook/begin': ["disqus.com", "Disqus"],
      'http://disqus.com/_ax/google/begin': ["disqus.com", "Disqus"],

      //instapaper
      'http://www.instapaper.com/j_ext': ["instapaper.com", "Instapaper"],
      'http://www.instapaper.com/j/': ["instapaper.com", "Instapaper"],
      'http://www.instapaper.com/bookmarklet/': ["instapaper.com", "Instapaper"],

      //pocket
      'http://getpocket.com/ext_save': ["getpocket.com", "Pocket"],

      //kinja - for gizmodo comments
      'https://api.kinja.com/api/token': ["api.kinja.com", "Kinja"],

      //facebook connect
      'https://www.facebook.com/ajax/connect/feedback.php': ["www.facebook.com", "Facebook"],

      //hootsuite
      'https://hootsuite.com/hootlet/compose': ["hootsuite.com", "Hootsuite"],
  },
  getWhitelistForPath: function(path){
    for(var name in this.list){
      if(path.indexOf(name) === 0){ return this.list[name] }
    }
    return undefined;
  },

}

exports.DomainExceptions = DomainExceptions;
return exports;
})();
