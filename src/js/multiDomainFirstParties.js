require.scopes.multiDomainFP = (function() {

/**
 * 2d array of related domains (etld+1), all domains owned by the same entity go into
 * an array, this is later transformed for efficient lookups.
 */
var _multiDomainFirstPartiesArray = [
  ["1800contacts.com", "800contacts.com"],
  ["37signals.com", "basecamp.com", "basecamphq.com", "highrisehq.com"],
  ["abcnews.com", "go.com", "espn.com", "espncdn.com", "disneymoviesanywhere.com", "disney.com", "dadt.com",
    "6abc.com", "abc7.com", "abc7ny.com"],
  ["accountonline.com", "citi.com", "citibank.com", "citicards.com", "citibankonline.com"],
  ["allstate.com", "myallstate.com"],
  ["altra.org", "altraonline.org"],
  ["amazon.com", "amazon.com.au", "amazon.ca", "amazon.co.jp", "amazon.co.uk", "amazon.de",
    "amazon.es", "amazon.fr", "amazon.it", "ssl-images-amazon.com", "media-amazon.com"],
  ["ameritrade.com", "tdameritrade.com"],
  ["ancestry.com", "mfcreative.com"],
  ["androidcentral.com", "mobilenations.com"],
  ["apple.com", "icloud.com"],
  ["applefcu.org", "applefcuonline.org"],
  ["archive.org", "openlibrary.org"],
  ["autodesk.com", "tinkercad.com"],
  ["avon.com", "youravon.com"],
  ["baidu.com", "bdimg.com", "bdstatic.com"],
  ["bananarepublic.com", "gap.com", "oldnavy.com", "piperlime.com"],
  ["bancomer.com", "bancomer.com.mx", "bbvanet.com.mx"],
  ["bankofamerica.com", "bofa.com", "mbna.com", "usecfo.com"],
  ["bank-yahav.co.il", "bankhapoalim.co.il"],
  ["belkin.com", "seedonk.com"],
  ["booking.com", "bstatic.com"],
  ["capitalone.com", "capitalone360.com"],
  ["century21.com", "21online.com"],
  ["chart.io", "chartio.com"],
  ["cnet.com", "cnettv.com", "com.com", "download.com", "news.com", "search.com", "upload.com"],
  ["concur.com", "concursolutions.com"],
  ["cox.com", "cox.net"],
  ["cricketwireless.com", "aiowireless.com"],
  ["dcu.org", "dcu-online.org"],
  ["diapers.com", "soap.com", "wag.com", "yoyo.com", "beautybar.com", "casa.com", "afterschool.com", "vine.com", "bookworm.com", "look.com", "vinemarket.com"],
  ["dictionary.com", "thesaurus.com", "sfdict.com"],
  ["discountbank.co.il", "telebank.co.il"],
  ["discover.com", "discovercard.com"],
  ["dropbox.com", "dropboxstatic.com", "getdropbox.com"],
  ["ea.com", "origin.com", "play4free.com", "tiberiumalliance.com"],
  ["ebay.com", "ebayimg.com", "ebayrtm.com", "ebaystatic.com", "ebay.de", "ebay.ca", "ebay.in", "ebay.co.uk", "ebay.com.au"],
  ["express-scripts.com", "medcohealth.com"],
  ["facebook.com", "fbcdn.com", "fbcdn.net", "facebook.net", "messenger.com"],
  ["firefox.com", "mozilla.org"],
  ["foxnews.com", "foxbusiness.com", "fncstatic.com"],
  ["github.com", "githubapp.com", "githubusercontent.com"],
  ["gizmodo.com", "kinja-img.com", "kinja-static.com", "deadspin.com", "lifehacker.com",
    "technoratimedia.com", "kinja.com", "jalopnik.com", "jezebel.com"],
  ["gogoair.com", "gogoinflight.com"],
  [
    "google.com",
    "youtube.com",
    "blogger.com",
    "gstatic.com",
    "googleusercontent.com",
    "ggpht.com",
    "ytimg.com",
    "googlevideo.com",
    "youtube-nocookie.com",
    "google.co.in",
    "google.co.jp",
    "google.de",
    "google.co.uk",
    "google.fr",
    "google.com.br",
    "google.ru",
    "google.it",
    "google.no",
    "google.ca",
    "gmail.com",
    "blog.google",
    "fonts.googleapis.com",
    "storage.googleapis.com",
    "www.googleapis.com",
  ],
  ["gotomeeting.com", "citrixonline.com"],
  ["guardian.co.uk", "guim.co.uk", "guardianapps.co.uk", "theguardian.com", "gu-web.net"],
  ["healthfusion.com", "healthfusionclaims.com"],
  ["hvfcu.org", "hvfcuonline.org"],
  ["logmein.com", "logme.in"],
  ["mandtbank.com", "mtb.com"],
  ["mathletics.com", "mathletics.com.au", "mathletics.co.uk"],
  ["mdsol.com", "imedidata.com"],
  ["meetup.com", "meetupstatic.com"],
  ["mercadolivre.com", "mercadolivre.com.br", "mercadolibre.com", "mercadolibre.com.ar", "mercadolibre.com.mx"],
  ["mi.com", "xiaomi.com"],
  [
    "microsoft.com",
    "aspnetcdn.com",
    "azureedge.net",
    "bing.com",
    "bing.net",
    "gfx.ms",
    "hotmail.com",
    "live.com",
    "microsoftonline.com",
    "microsoftstore.com",
    "msn.com",
    "msocdn.com",
    "office365.com",
    "office.com",
    "onestore.ms",
    "passport.net",
    "sharepoint.com",
    "s-microsoft.com",
    "windows.com",
    "xboxlive.com",
  ],
  ["mobilism.org.in", "mobilism.org"],
  ["morganstanley.com", "morganstanleyclientserv.com", "stockplanconnect.com", "ms.com"],
  ["msnbc.com", "nbcnews.com", "newsvine.com"],
  ["my-bookings.org", "my-bookings.cc"],
  ["mycanal.fr", "canal-plus.com"],
  ["mymerrill.com", "ml.com", "merrilledge.com"],
  ["mynortonaccount.com", "norton.com"],
  ["mysmartedu.com", "mysmartabc.com"],
  ["mysql.com", "oracle.com"],
  ["myuv.com", "uvvu.com"],
  ["nefcuonline.com", "nefcu.com"],
  ["netflix.com", "nflxext.com", "nflximg.net", "nflxvideo.net"],
  ["norsk-tipping.no", "buypass.no"],
  ["nymag.com", "vulture.com", "grubstreet.com"],
  ["nytimes.com", "newyorktimes.com", "nyt.com"],
  ["onlineatnsb.com", "norwaysavingsbank.com"],
  ["paypal.com", "paypal-search.com"],
  ["pcworld.com", "staticworld.net", "idg.com", "idg.net", "infoworld.com", "macworld.com", "techhive.com", "idg.tv"],
  ["pepco.com", "pepcoholdings.com"],
  ["philips.com", "philips.nl"],
  ["playstation.com", "sonyentertainmentnetwork.com"],
  ["pokemon-gl.com", "pokemon.com"],
  ["pornhub.com", "phncdn.com"],
  ["postepay.it", "poste.it"],
  [
    "qq.com",
    "dnspod.cn",
    "gtimg.cn",
    "gtimg.com",
    "qcloud.com",
    "tencent.com",
    "wechat.com",
    "wegame.com",
    "weiyun.com",
  ],
  ["railnation.ru", "railnation.de", "rail-nation.com", "railnation.gr", "railnation.us", "trucknation.de", "traviangames.com"],
  ["rakuten.com", "buy.com"],
  ["reddit.com", "redditmedia.com", "redditstatic.com", "redd.it", "redditenhancementsuite.com", "reddituploads.com", "imgur.com"],
  ["sanguosha.com", "bianfeng.com"],
  ["schwab.com", "schwabplan.com"],
  ["sears.com", "shld.net"],
  ["shopify.com", "myshopify.com"],
  ["siriusxm.com", "sirius.com"],
  ["skygo.co.nz", "skytv.co.nz"],
  ["skysports.com", "skybet.com", "skyvegas.com"],
  ["snapfish.com", "snapfish.ca"],
  ["sony.com", "sonyrewards.com"],
  ["soundcu.com", "netteller.com"],
  ["southerncompany.com", "southernco.com"],
  ["southparkstudios.com", "cc.com", "comedycentral.com"],
  ["sprint.com", "sprintpcs.com", "nextel.com"],
  ["steampowered.com", "steamstatic.com", "steamcommunity.com"],
  ["taobao.com", "alicdn.net", "tmail.com", "tbcdn.cn", "alibaba.com",
    "aliexpress.com", "tmall.com", "alimama.com", "1688.com", "aliyun.com", "net.cn", "www.net.cn"],
  ["techdata.com", "techdata.ch"],
  ["telekom.com", "t-online.de"],
  ["tesla.com", "teslamotors.com"],
  ["tripadvisor.com", "tacdn.com", "tamgrt.com"],
  ["trsretire.com", "divinvest.com"],
  ["turbotax.com", "intuit.com"],
  ["twitch.tv", "ttvnw.net", "jtvnw.net"],
  ["twitter.com", "twimg.com", "t.co"],
  ["ua2go.com", "ual.com", "united.com", "unitedwifi.com"],
  ["verizon.com", "verizon.net"],
  ["vk.com", "vk.me", "vkontakte.ru"],
  ["volkskrant.nl", "persgroep.net", "persgroep.nl", "parool.nl"],
  ["volvooceanrace.com", "virtualregatta.com"],
  ["walmart.com", "wal.co"],
  ["wellsfargo.com", "wf.com"],
  ["wikia.com", "wikia.net", "nocookie.net"],
  ["wikipedia.org", "wikimedia.org", "wikimediafoundation.org", "wiktionary.org",
    "wikiquote.org", "wikibooks.org", "wikisource.org", "wikinews.org",
    "wikiversity.org", "mediawiki.org", "wikidata.org", "wikivoyage.org"],
  ["wordpress.com", "wp.com"],
  ["wpcu.coop", "wpcuonline.com"],
  ["wsj.com", "wsj.net", "barrons.com", "dowjones.com", "marketwatch.com"],
  ["xda-developers.com", "xda-cdn.com"],
  ["xfinity.com", "comcast.net", "comcast.com"],
  ["xiami.com", "alipay.com"],
  ["yahoo.com", "yahooapis.com", "yimg.com", "yahoo.co.jp", "overture.com", "flickr.com"],
  ["yandex.ru", "yastatic.net", "yandex.net"],
  ["zendesk.com", "zopim.com"],
  ["zillow.com", "zillowstatic.com", "zillowcloud.com"],
  ["zoho.com", "zoho.eu", "zohocorp.com", "zohocreator.com", "zohopublic.com", "zohostatic.com"],
  ["zonealarm.com", "zonelabs.com"],
];

/**
 * Make a data structure for quick lookups of whether two domains are the same first party
 */
function makeDomainLookup(mdfpArray) {
  let out = {},
    arrLength = mdfpArray.length;
  for (let i = 0; i < arrLength; i++) {
    let inner = new Set(mdfpArray[i]);
    for (let domain of inner) {
      out[domain] = inner;
    }
  }
  return out;
}

function makeIsMultiDomainFirstParty(domainLookup) {
  return function (domain1, domain2) {
    if (domain1 in domainLookup) {
      return (domainLookup[domain1].has(domain2));
    }
    return false;
  };
}

let _domainLookup = makeDomainLookup(_multiDomainFirstPartiesArray);
/**
 * Check if two domains belong to the same effective first party
 * @param {String} domain1 a base doamin
 * @param {String} domain2 a second base doamin
 *
 * @return boolean true if the domains are the same first party
 **/
let isMultiDomainFirstParty = makeIsMultiDomainFirstParty(_domainLookup);
/************************************** exports */
return {isMultiDomainFirstParty, makeDomainLookup, makeIsMultiDomainFirstParty};
})(); //require scopes
