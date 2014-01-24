var CookieBlockList = exports.CookieBlockList = {
  domains: [],
  addDomain: function(domain){
    if(this.domains.indexOf(domain) < 0){
      this.domains.push(domain);
    }
  },
  removeDomain: function(domain){
    var idx= this.domains.indexOf(domain);
    if(idx >= 0){
      this.domains.remove(idx);
    }
  }
}

Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
