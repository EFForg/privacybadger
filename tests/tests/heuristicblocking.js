(function() {
  module("Privacy Badger Heuristic Blocking");

  var CookieBlockList = require("cookieblocklist").CookieBlockList;
  var BlockedDomainList = require("blockedDomainList").BlockedDomainList;
  var FilterStorage = require("filterStorage").FilterStorage;

  test("Get Domain From Filter",function() {
    var domain = getDomainFromFilter("@@||ally.com^$third-party");
    ok(domain === 'ally.com',"The domain is successfully filtered");
  });

  test("addFiltersFromWhitelistToCookieblock",function (){
    addFiltersFromWhitelistToCookieblock("test.bit.ly");
    var checkCookie = CookieBlockList.hasDomain("bit.ly");
    ok(checkCookie,"adding to cookieBlockList is working");

  });

  /*test("blacklistOrigin",function(){
    blacklistOrigin("zopim.com","support.zopim.com");
    var blockedDomain = BlockedDomainList.hasDomain("support.zopim.com");
    var cookie = CookieBlockList.hasDomain("zopim.com");
    ok(blockedDomain,"Domain successfully blocked");
    ok(cookie,"Cookie Succesfully blocked");
  });

  test("Record prevalence",function(){
    var seenThirdParties = function(){return JSON.parse(localStorage.seenThirdParties)};
    var updatelocalStorage = function(tracker){
      var updateThirdParties = JSON.parse(localStorage.seenThirdParties);
      delete updateThirdParties[tracker];
      localStorage.seenThirdParties = JSON.stringify(updateThirdParties);
    }
    var origLength =  Object.keys(seenThirdParties()).length;
    recordPrevalence("support.zopim.com", "zopim.com", "1");
    ok(Object.keys(seenThirdParties()).length == (origLength + 1), "One origin added");
    recordPrevalence("support.zopim.com", "zopim.com", "2");
    recordPrevalence("support.zopim.com", "zopim.com", "3");

    var origLength_later =  Object.keys(seenThirdParties()).length;
    ok(Object.keys(seenThirdParties()["zopim.com"]).length == (origLength + 3), "Same origin appeared in three tabs");
    updatelocalStorage("zopim.com");

  });*/

})();
