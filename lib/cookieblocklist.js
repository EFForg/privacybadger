var Utils = require('utils').Utils;

var CookieBlockList = exports.CookieBlockList = {
  domains: [],
  updateDomains: function(){
    var self = this;
    chrome.storage.local.get('cookieblocklist', function(items){
      if(chrome.runtime.lastError || !items.cookieblocklist){
        //cookie block list has never been set so we initialize it with an empty array
        chrome.storage.local.set({cookieblocklist: self.domains});
        return;
      }
      self.domains = items.cookieblocklist;
    });
  },
  addDomain: function(domain, cb){
    console.log('adding domain');
    if(!this.hasDomain(domain)){
      this.domains.push(domain);
      chrome.storage.local.set({cookieblocklist: this.domains},function(){
        if(cb && typeof(cb) === "function"){
          cb();
        }
      });
    }
  },
  removeDomain: function(domain){
    if(this.hasDomain(domain)){
      Utils.removeElementFromArray(this.domains,this.domains.indexOf(domain));
      chrome.storage.local.set({cookieblocklist: this.domains});
    }
  },
  hasDomain: function(domain){

    var idx = this.domains.indexOf(domain);
    if(idx < 0){
      return false;
    } else {
      return true;
    }
  },
  hasBaseDomain: function(baseDomain){
    for(var i = 0; i < this.domains.length; i++){
      if(getBaseDomain(this.domains[i]) == baseDomain){
        return true;
      }
    }
    return false;
  }
}

