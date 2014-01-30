var FakeCookieSore = exports.FakeCookieStore = {
  cookies: {},
  updateCookies: function(){
    chrome.storage.local.get('fakecookiestore', function(items){
      if(chrome.runtime.lastError){
        //cookie block list has never been set so we initialize it with an empty array
        chrome.storage.local.set({fakecookiestore: this.cookies});
        return;
      }
      this.cookies = items.fakecookiestore;
    });
  },
  getCookies: function(domain){
    console.log('!!GET cookies for ', domain);
    if(this.cookies[domain]){
      return this.cookies[domain];
    } else {
      return {};
    }
  },
  setCookies: function(domain, newCookies){
    console.log('!!ADDING cookies to fake cookie store:', newCookies);
    if(!this.cookies[domain]){
      this.cookies[domain] = {};
    }
    for(var i = 0; i < newCookies.length; i++){
      var cookieName = newCookies[i].name;
      this.cookies[domain][cookieName] = newCookies[i];
    }
    chrome.storage.local.set({fakecookiestore: this.cookies});
  },
  removeCookie: function(domain, name){
    console.log('!!REMOVE cookie for domain and name', domain, name);
    if(!this.cookies[domain]){
      return;
    }
    for(var i = 0; i < this.cookies[domain].length; i++){
      if(this.cookies[domain][i].name == name){
        this.cookies[domain].remove(i);
        return;
      }
    }
  }
}
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
