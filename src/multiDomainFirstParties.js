/**
 * Some thoughts about how to handle multi domain first parites.
 * Given a data strucutre like the one below we could implement the following 
 * pseudo code.
 * function isMultiDomainFirstParty(domain1, domain2):
 *   for list in multiDomainFirstPartiesArray:  // the below data structure
 *     if list.contains(domain1) and list.contains(domain2):
 *       return true
 *   return false
 *
 *   This list should be manually curated but could be generated by crawlilng
 *   whois data, DNT data, certificate info, etc. 
 **/ 
require.scopes.multiDomainFP = (function() {

/**
 * 2d array of related domains, all domains owned by the same entity go into 
 * an array, this is later transformed for efficient lookups. 
 */
var _multiDomainFirstPartiesArray = [
  ["google.com", "youtube.com", "blogger.com", "gstatic.com", "googleapis.com",
    "googleusercontent.com", "ggpht.com", "ytimg.com", "googlevideo.com", 
    "youtube-nocookie.com", "google.co.in", "google.co.jp", "google.de", 
    "google.co.uk", "google.fr", "google.com.br", "google.ru", "google.it", "google.no",
    "google.ca","gmail.com"],
  ["facebook.com", "fbcdn.com", "fbcdn.net", "facebook.net", "messenger.com"],
  ["newyorktimes.com", "nyt.com"],
  ["yahooapis.com", "yimg.com", "yahoo.com", "yahoo.co.jp","overture.com"],
  ["reddit.com", "redditmedia.com", "redditstatic.com", "redd.it", "redditenhancementsuite.com", "reddituploads.com", "imgur.com"],
  ["github.com", "githubapp.com", "githubusercontent.com"],
  ["dropbox.com", "dropboxstatic.com","getdropbox.com"],
  ["abcnews.com", "go.com", "espn.com", "espncdn.com"],
  ["gizmodo.com", "kinja-img.com", "kinja-static.com", "deadspin.com", "lifehacker.com",
    "technoratimedia.com", "kinja.com", "jalopnik.com", "jezebel.com"],
  ["wikia.com", "wikia.net", "nocookie.net"],
  ["tripadvisor.com", "tacdn.com", "tamgrt.com"],
  ["baidu.com", "bdimg.com", "bdstatic.com"],
  ["wikipedia.org", "wikimedia.org", "wikimediafoundation.org", "wiktionary.org", 
    "wikiquote.org", "wikibooks.org", "wikisource.org", "wikinews.org", 
    "wikiversity.org", "mediawiki.org", "wikidata.org", "wikivoyage.org"],
  ["twitter.com", "twimg.com", "t.co"],
  [ "amazon.com", "amazon.com.au", "amazon.ca", "amazon.co.jp", "amazon.co.uk", "amazon.de", 
    "amazon.es", "amazon.fr", "amazon.it", "ssl-images-amazon.com", "media-amazon.com"],
  ["pornhub.com", "phncdn.com"],
  ["msn.com", "bing.com", "live.com", "bing.net", "microsoft.com","office365.com",
    "aspnetcdn.com", "microsoftonline.com", "onestore.ms", "microsoftstore.com",
    "s-microsoft.com", "xboxlive.com", "gfx.ms", "azureedge.net", "hotmail.com",
    "office.com", "msocdn.com","passport.net","windows.com"],
  ["yandex.ru", "yastatic.net", "yandex.net"],
  ["taobao.com", "alicdn.net", "tmail.com", "tbcdn.cn", "alibaba.com", 
    "aliexpress.com","tmall.com","alimama.com","1688.com","aliyun.com","net.cn","www.net.cn"],
  ["ebay.com", "ebayimg.com", "ebayrtm.com", "ebaystatic.com","ebay.de","ebay.ca","ebay.in","ebay.co.uk","ebay.com.au"],
  ["wordpress.com", "wp.com"], 
  ["netflix.com", "nflxext.com", "nflximg.net", "nflxvideo.net"],
  ["steampowered.com", "steamstatic.com", "steamcommunity.com"],
  ["walmart.com", "wal.co"], 
  ["ancestry.com", "mfcreative.com"],
  ["zillow.com", "zillowstatic.com", "zillowcloud.com"],
  ["xda-developers.com", "xda-cdn.com"],
  ["booking.com", "bstatic.com"],
  ["southparkstudios.com", "cc.com", "comedycentral.com"],
  ["twitch.tv", "ttvnw.net", "jtvnw.net"],
  ["guardian.co.uk", "guim.co.uk", "guardianapps.co.uk", "theguardian.com", "gu-web.net"],
  ["wsj.com", "wsj.net"],
  ["nymag.com", "vulture.com", "grubstreet.com"],
  ["pcworld.com", "staticworld.net", "idg.com", "idg.net", "infoworld.com", "macworld.com", 
    "techhive.com", "idg.tv"],
  ["xfinity.com", "comcast.net","comcast.com"],
  ["philips.com", "philips.nl"],
  ["vk.com", "vk.me", "vkontakte.ru"],
  ["volkskrant.nl", "persgroep.net", "persgroep.nl", "parool.nl"],
  ["1800contacts.com","800contacts.com"],
  ["37signals.com","basecamp.com","basecamphq.com","highrisehq.com"],
  ["accountonline.com","citi.com","citibank.com","citicards.com","citibankonline.com"],
  ["allstate.com","myallstate.com"],
  ["altra.org","altraonline.org"],
  ["ameritrade.com","tdameritrade.com"],
  ["androidcentral.com","mobilenations.com"],
  ["apple.com","icloud.com"],
  ["applefcu.org","applefcuonline.org",
  ["autodesk.com","tinkercad.com"],
  ["avon.com","youravon.com"],
  ["bananarepublic.com","gap.com","oldnavy.com","piperlime.com"],
  ["bancomer.com","bancomer.com.mx","bbvanet.com.mx"],
  ["bankofamerica.com","bofa.com","mbna.com","usecfo.com"],
  ["bank-yahav.co.il","bankhapoalim.co.il"],
  ["belkin.com","seedonk.com"],
  ["capitalone.com","capitalone360.com"],
  ["century21.com","21online.com"],
  ["chart.io","chartio.com"],
  ["cnet.com","cnettv.com","com.com","download.com","news.com","search.com","upload.com"],
  ["concur.com","concursolutions.com"],
  ["cox.com","cox.net"],
  ["cricketwireless.com","aiowireless.com"],
  ["dcu.org","dcu-online.org"],
  ["diapers.com","soap.com","wag.com","yoyo.com","beautybar.com","casa.com","afterschool.com","vine.com","bookworm.com","look.com","vinemarket.com"],
  ["discountbank.co.il","telebank.co.il"],
  ["discover.com","discovercard.com"],
  ["disneymoviesanywhere.com","go.com","disney.com","dadt.com"],
  ["ea.com","origin.com","play4free.com","tiberiumalliance.com"],
  ["express-scripts.com","medcohealth.com"],
  ["facebook.com","messenger.com"],
  ["firefox.com","mozilla.org"],
  ["gogoair.com","gogoinflight.com"],
  ["gotomeeting.com","citrixonline.com"],
  ["healthfusion.com","healthfusionclaims.com"],
  ["hvfcu.org","hvfcuonline.org"],
  ["logmein.com","logme.in"],
  ["mandtbank.com","mtb.com"],
  ["mathletics.com","mathletics.com.au","mathletics.co.uk"],
  ["mdsol.com","imedidata.com"],
  ["mercadolivre.com","mercadolivre.com.br","mercadolibre.com","mercadolibre.com.ar","mercadolibre.com.mx"],
  ["mi.com","xiaomi.com"],
  ["morganstanley.com","morganstanleyclientserv.com","stockplanconnect.com","ms.com"],
  ["my-bookings.org","my-bookings.cc"],
  ["mycanal.fr","canal-plus.com"],
  ["mymerrill.com","ml.com","merrilledge.com"],
  ["mynortonaccount.com","norton.com"],
  ["mysmartedu.com","mysmartabc.com"],
  ["mysql.com","oracle.com"],
  ["myuv.com","uvvu.com"],
  ["nefcuonline.com","nefcu.com"],
  ["norsk-tipping.no","buypass.no"],
  ["onlineatnsb.com","norwaysavingsbank.com"],
  ["overture.com","yahoo.com","flickr.com"],
  ["paypal.com","paypal-search.com"],
  ["pepco.com","pepcoholdings.com"],
  ["playstation.com","sonyentertainmentnetwork.com"],
  ["pokemon-gl.com","pokemon.com"],
  ["postepay.it","poste.it"],
  ["railnation.ru","railnation.de","rail-nation.com","railnation.gr","railnation.us","trucknation.de","traviangames.com"],
  ["rakuten.com","buy.com"],
  ["sanguosha.com","bianfeng.com"],
  ["schwab.com","schwabplan.com"],
  ["sears.com","shld.net"],
  ["shopify.com","myshopify.com"],
  ["siriusxm.com","sirius.com"],
  ["skygo.co.nz","skytv.co.nz"],
  ["skysports.com","skybet.com","skyvegas.com"],
  ["snapfish.com","snapfish.ca"],
  ["sony.com","sonyrewards.com"],
  ["soundcu.com","netteller.com"],
  ["southerncompany.com","southernco.com"],
  ["sprint.com","sprintpcs.com","nextel.com"],
  ["steampowered.com","steamcommunity.com"],
  ["techdata.com","techdata.ch"],
  ["telekom.com","t-online.de"],
  ["tesla.com","teslamotors.com"],
  ["trsretire.com","divinvest.com"],
  ["turbotax.com","intuit.com"],
  ["ua2go.com","ual.com","united.com","unitedwifi.com"],
  ["verizon.com","verizon.net"],
  ["volvooceanrace.com","virtualregatta.com"],
  ["wellsfargo.com","wf.com"],
  ["wpcu.coop","wpcuonline.com"],
  ["xiami.com","alipay.com"],
  ["zendesk.com","zopim.com"],
  ["zonealarm.com","zonelabs.com"],
  ["dummy"]
];

/**
 * Make a data structure for quick lookups of whether two domains are the same first party
 */
function _makeDomainLookup() {
  var arr = _multiDomainFirstPartiesArray;
  var out = {};
  var arrLength = arr.length;
  for (var i = 0; i < arrLength; i++) {
    var inLength = arr[i].length;
    for (var j = 0; j < inLength; j++) {
      out[arr[i][j]] = arr[i];
    }
  }
  return out;
}

var DomainLookup = _makeDomainLookup();

/**
 * Check if two domains belong to the same effective first party
 * @param {String} domain1 a base doamin
 * @param {String} domain2 a second base doamin
 *
 * @return boolean true if the domains are the same first party
 **/
function isMultiDomainFirstParty(domain1, domain2) {
  if (domain1 in DomainLookup) {
    return (DomainLookup[domain1].indexOf(domain2) >= 0);
  }
  return false;
}

/************************************** exports */
var exports = {};

exports.isMultiDomainFirstParty = isMultiDomainFirstParty;

return exports;
/************************************** exports */
})(); //require scopes
