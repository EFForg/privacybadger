var CookieBlockList = exports.CookieBlockList = {
  domains: [],
  updateDomains: function(){
    chrome.storage.sync.get('cookieblocklist', function(items){
      var self = this;
      if(chrome.runtime.lastError){
        //cookie block list has never been set so we initialize it with an empty array
        chrome.storage.sync.set({cookieblocklist: this.domains});
        return;
      }
      self.domains = items.cookieblocklist;
    });
  },
  addDomain: function(domain){
    console.log('adding domain');
    if(!this.hasDomain(domain)){
      this.domains.push(domain);
      chrome.storage.sync.set({cookieblocklist: this.domains});
    }
  },
  removeDomain: function(domain){
    if(this.hasDomain(domain)){
      this.domains.remove(this.domains.indexOf(domain));
      chrome.storage.sync.set({cookieblocklist: this.domains});
    }
  },
  hasDomain: function(domain){
    var idx = this.domains.indexOf(domain);
    if(idx < 0){
      return false;
    } else {
      return true;
    }
  }
}

Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
