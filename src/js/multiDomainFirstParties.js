require.scopes.multiDomainFP = (function() {

/**
 * 2d array of related domains (etld+1), all domains owned by the same entity go into
 * an array, this is later transformed for efficient lookups.
 */
var multiDomainFirstPartiesArray = [
  ["1800contacts.com", "800contacts.com"],
  ["37signals.com", "basecamp.com", "basecamphq.com", "highrisehq.com"],
  [
    "abcnews.com",
    "6abc.com",
    "abc7.com",
    "abc7ny.com",

    "go.com",

    "espn.com",
    "espncdn.com",

    "espn.com.au",
    "espn.com.br",
    "espn.co.uk",

    "espncricinfo.com",

    "espnfc.com",
    "espnfc.us",

    "fivethirtyeight.com",

    "disney.com",
    "disneymoviesanywhere.com",
    "dadt.com",
  ],
  ["accountonline.com", "citi.com", "citibank.com", "citicards.com", "citibankonline.com"],
  [
    "adobe.com",
    "adobeexchange.com",
    "adobe.io",
    "adobelogin.com",
    "behance.net",
    "mixamo.com",
    "myportfolio.com",
    "typekit.com",
  ],
  ["allstate.com", "myallstate.com"],
  ["altra.org", "altraonline.org"],
  [
    "amazon.com",

    "amazon.ca",
    "amazon.co.jp",
    "amazon.com.au",
    "amazon.com.mx",
    "amazon.co.uk",
    "amazon.de",
    "amazon.es",
    "amazon.fr",
    "amazon.in",
    "amazon.it",

    "audible.com",

    "audible.co.uk",
    "audible.de",
    "audible.in",

    "6pm.com",
    "imdb.com",
    "primevideo.com",
    "shopbop.com",
    "twitch.tv",
    "zappos.com",

    "amazonpay.com",
    "media-amazon.com",
    "ssl-images-amazon.com",
  ],
  [
    "americanexpress.com",

    "americanexpress.ca",
    "americanexpress.ch",
    "americanexpress.com.au",
    "americanexpress.co.uk",
    "americanexpress.no",

    "membershiprewards.ca",
    "membershiprewards.com.ar",
    "membershiprewards.com.au",
    "membershiprewards.com.sg",
    "membershiprewards.co.uk",
    "membershiprewards.de",

    "aetclocator.com",
    "americanexpressfhr.com",
    "amexnetwork.com",
    "amextravel.com",
    "amextravelresources.com",
    "thecenturionlounge.com",
    "yourcarrentalclaim.com",

    "aexp-static.com",
  ],
  ["ameritrade.com", "tdameritrade.com"],
  [
    "ancestry.com",

    "ancestry.ca",
    "ancestry.com.au",
    "ancestry.co.uk",
    "ancestry.de",
    "ancestry.fr",
    "ancestry.ie",
    "ancestry.it",
    "ancestry.mx",
    "ancestry.nl",
    "ancestry.no",
    "ancestry.pl",
    "ancestry.se",

    "ancestrylibrary.com",
    "archives.com",
    "findagrave.com",
    "fold3.com",
    "newspapers.com",
    "progenealogists.com",
    "rootsweb.com",

    "ancestrylibrary.ca",

    "mfcreative.com",
    "ancestrycdn.com",
  ],
  ["androidcentral.com", "mobilenations.com"],
  ["apple.com", "icloud.com"],
  ["applefcu.org", "applefcuonline.org"],
  ["archive.org", "openlibrary.org"],
  [
    "autodesk.com",
    "autodesk.net",
    "circuits.io",
    "tinkercad.com",

    "autodesk.ae",
    "autodesk.be",
    "autodesk.ca",
    "autodesk.ch",
    "autodesk.co.jp",
    "autodesk.co.kr",
    "autodesk.com.au",
    "autodesk.com.br",
    "autodesk.com.cn",
    "autodesk.com.hk",
    "autodesk.com.my",
    "autodesk.com.sg",
    "autodesk.com.tr",
    "autodesk.com.tw",
    "autodesk.co.nz",
    "autodesk.co.uk",
    "autodesk.co.za",
    "autodesk.cz",
    "autodesk.de",
    "autodesk.dk",
    "autodesk.es",
    "autodesk.eu",
    "autodesk.fi",
    "autodesk.fr",
    "autodesk.hu",
    "autodesk.in",
    "autodesk.it",
    "autodesk.mx",
    "autodesk.nl",
    "autodesk.no",
    "autodesk.pl",
    "autodesk.pt",
    "autodesk.ru",
    "autodesk.se",
  ],
  ["avito.ru", "avito.st"],
  ["avon.com", "youravon.com"],
  ["baidu.com", "bdimg.com", "bdstatic.com"],
  ["bancomer.com", "bancomer.com.mx", "bbvanet.com.mx"],
  ["bankofamerica.com", "bofa.com", "mbna.com", "usecfo.com"],
  ["bank-yahav.co.il", "bankhapoalim.co.il"],
  ["bbc.co.uk", "bbc.com", "bbci.co.uk"],
  ["belkin.com", "seedonk.com"],
  [
    "bitbucket.org",

    "atlassian.com",
    "atlassian.io",
    "atlassian.net",

    "customercase.com",
    "enso.me",
    "hipchat.com",
    "jira.com",
    "statuspage.io",
    "stride.com",
    "trello.com",
  ],
  ["blizzard.com", "battle.net", "worldofwarcraft.com"],
  ["bloomberg.com", "bbthat.com", "bwbx.io"],
  ["booking.com", "bstatic.com"],
  ["box.com", "boxcdn.net"],
  ["capitalone.com", "capitalone360.com"],
  [
    "cbs.com",

    "cbsi.com",
    "cbsig.net",
    "cbsimg.net",
    "cbsinteractive.com",
    "cbsistatic.com",
    "cbsnews.com",
    "cbssports.com",
    "cbsstatic.com",
    "chow.com",
    "chowhound.com",
    "chowmagazine.com",
    "chowstatic.com",
    "cnet.com",
    "cnetcontent.com",
    "cnettv.com",
    "collegesports.com",
    "com.com",
    "comicvine.com",
    "download.com",
    "etonline.com",
    "fansonly.com",
    "gamespot.com",
    "giantbomb.com",
    "insideedition.com",
    "last.fm",
    "metacritic.com",
    "news.com",
    "scout.com",
    "search.com",
    "sho.com",
    "sportsline.com",
    "techrepublic.com",
    "tv.com",
    "tvgcdn.net",
    "tvguide.com",
    "upload.com",
    "zdnet.com",
  ],
  ["century21.com", "21online.com"],
  ["chart.io", "chartio.com"],
  ["concur.com", "concursolutions.com"],
  ["cox.com", "cox.net"],
  ["cricketwireless.com", "aiowireless.com"],
  ["dcu.org", "dcu-online.org"],
  ["diapers.com", "soap.com", "wag.com", "yoyo.com", "beautybar.com", "casa.com", "afterschool.com", "vine.com", "bookworm.com", "look.com", "vinemarket.com"],
  ["dictionary.com", "thesaurus.com", "sfdict.com"],
  ["discountbank.co.il", "telebank.co.il"],
  ["discover.com", "discovercard.com"],
  ["dropbox.com", "dropboxstatic.com", "dropboxusercontent.com", "getdropbox.com"],
  ["d.rip", "kickstarter.com"],
  ["ea.com", "origin.com", "play4free.com", "tiberiumalliance.com"],
  [
    "ebay.com",

    "ebay.at",
    "ebay.be",
    "ebay.ca",
    "ebay.ch",
    "ebay.com.au",
    "ebay.com.hk",
    "ebay.com.my",
    "ebay.com.sg",
    "ebay.co.uk",
    "ebay.de",
    "ebay.es",
    "ebay.fr",
    "ebay.ie",
    "ebay.in",
    "ebay.it",
    "ebay.nl",
    "ebay.ph",
    "ebay.pl",

    "ebaydesc.com",
    "ebayimg.com",
    "ebayrtm.com",
    "ebaystatic.com",
  ],
  [
    "enterprise.com",

    "alamo.ca",
    "alamo.com",

    "enterprise.ca",
    "enterprise.ch",
    "enterprise.com.jm",
    "enterprise.co.uk",
    "enterprise.de",
    "enterprise.dk",
    "enterprise.ec",
    "enterprise.es",
    "enterprise.fr",
    "enterprise.gr",
    "enterprise.hr",
    "enterprise.hu",
    "enterprise.ie",
    "enterprise.lv",
    "enterprise.nl",
    "enterprise.no",
    "enterprise.pt",
    "enterprise.se",

    "enterprisecarclub.co.uk",

    "enterprisecarshare.ca",
    "enterprisecarshare.com",
    "enterprisecarshare.co.uk",

    "enterpriserideshare.com",

    "enterpriserentacar.at",
    "enterpriserentacar.be",
    "enterpriserentacar.bg",
    "enterpriserentacar.ca",
    "enterpriserentacar.com.au",
    "enterpriserentacar.co.nz",
    "enterpriserentacar.cz",
    "enterpriserentacar.is",
    "enterpriserentacar.it",
    "enterpriserentacar.pl",
    "enterpriserentacar.se",

    "nationalcar.ca",
    "nationalcar.com",
    "nationalcar.co.uk",
    "nationalcar.de",
    "nationalcar.es",
    "nationalcar.fr",
    "nationalcar.ie",
    "nationalcar.it",
  ],
  [
    "expedia.com",

    "carrentals.com",
    "cheaptickets.com",
    "ebookers.com",
    "hotels.com",
    "hotwire.com",
    "mrjet.se",
    "orbitz.com",
    "travelocity.com",
    "wotif.com",

    "expedia-aarp.com",
    "expedia-barclays.co.uk",
    "expedia-cn.com",
    "expedia.at",
    "expedia.be",
    "expedia.ca",
    "expedia.ch",
    "expedia.cn",
    "expedia.co.id",
    "expedia.co.in",
    "expedia.co.jp",
    "expedia.co.kr",
    "expedia.co.nz",
    "expedia.co.th",
    "expedia.co.uk",
    "expedia.com.ar",
    "expedia.com.au",
    "expedia.com.br",
    "expedia.com.hk",
    "expedia.com.my",
    "expedia.com.ph",
    "expedia.com.sg",
    "expedia.com.tw",
    "expedia.com.vn",
    "expedia.de",
    "expedia.dk",
    "expedia.es",
    "expedia.fi",
    "expedia.fr",
    "expedia.ie",
    "expedia.it",
    "expedia.mx",
    "expedia.nl",
    "expedia.no",
    "expedia.ru",
    "expedia.se",
    "expediacorporate.eu",

    "expedia.net",

    "travel-assets.com",
    "trvl-media.com",

    "lastminute.com.au",
    "lastminute.co.nz",
    "wotif.com.au",
    "wotif.co.nz",

    "cdn-hotels.com",
    "hotels.cn",

    "hotwirestatic.com",

    "ebookers.at",
    "ebookers.be",
    "ebookers.ch",
    "ebookers.co.uk",
    "ebookers.de",
    "ebookers.fi",
    "ebookers.fr",
    "ebookers.ie",
    "ebookers.nl",
    "ebookers.no",

    "mrjet.dk",
  ],
  ["express-scripts.com", "medcohealth.com"],
  ["facebook.com", "fbcdn.com", "fbcdn.net", "fbsbx.com", "facebook.net", "messenger.com"],
  [
    "fandom.com",
    "fandom-dev.pl",
    "fandom-dev.us",
    "nocookie.net",
    "wikia.com",
    "wikia-dev.com",
    "wikia-dev.pl",
    "wikia-dev.us",
    "wikiafanstudio.com",
    "wikia-inc.com",
    "wikia.net",
    "wikia.org",
    "wikia-services.com",
    "wikia-staging.com",
  ],
  ["fastmail.com", "fastmailusercontent.com"],
  ["firefox.com", "firefoxusercontent.com", "mozilla.org"],
  ["foxnews.com", "foxbusiness.com", "fncstatic.com"],
  [
    "gap.com",

    "bananarepublic.com",
    "gapfactory.com",
    "gapinc.com",
    "oldnavy.com",
    "piperlime.com",

    "bananarepublic.ca",
    "bananarepublic.co.jp",
    "bananarepublic.co.uk",
    "bananarepublic.eu",
    "gapcanada.ca",
    "gap.co.jp",
    "gap.co.uk",
    "gap.eu",
    "gap.hk",
    "oldnavy.ca",

    "assets-gap.com",
  ],
  [
    "gettyimages.com",

    "gettyimages.ca",
    "gettyimages.com.au",
    "gettyimages.co.uk",
    "gettyimages.dk",
    "gettyimages.fi",
    "gettyimages.nl",

    "istockphoto.com",

    "thinkstockphotos.com",
    "thinkstockphotos.ca",
  ],
  ["github.com", "githubapp.com"],
  ["gizmodo.com", "kinja-img.com", "kinja-static.com", "deadspin.com", "lifehacker.com",
    "technoratimedia.com", "kinja.com", "jalopnik.com", "jezebel.com"],
  [
    "glassdoor.com",

    "glassdoor.be",
    "glassdoor.ca",
    "glassdoor.co.in",
    "glassdoor.com.au",
    "glassdoor.co.uk",
    "glassdoor.de",
    "glassdoor.fr",
    "glassdoor.ie",
    "glassdoor.nl",
  ],
  ["gogoair.com", "gogoinflight.com"],
  [
    "google.com",
    "youtube.com",
    "gmail.com",
    "blogger.com",
    "blog.google",
    "googleblog.com",
    "chromium.org",

    "ggpht.com",
    "googleusercontent.com",
    "googlevideo.com",
    "gstatic.com",
    "youtube-nocookie.com",
    "ytimg.com",

    "google.ad",
    "google.ae",
    "google.al",
    "google.am",
    "google.as",
    "google.at",
    "google.az",
    "google.ba",
    "google.be",
    "google.bf",
    "google.bg",
    "google.bi",
    "google.bj",
    "google.bs",
    "google.bt",
    "google.by",
    "google.ca",
    "google.cat",
    "google.cd",
    "google.cf",
    "google.cg",
    "google.ch",
    "google.ci",
    "google.cl",
    "google.cm",
    "google.cn",
    "google.com.af",
    "google.com.ag",
    "google.com.ai",
    "google.com.ar",
    "google.com.au",
    "google.com.bd",
    "google.com.bh",
    "google.com.bn",
    "google.com.bo",
    "google.com.br",
    "google.com.bz",
    "google.com.co",
    "google.com.cu",
    "google.com.cy",
    "google.com.do",
    "google.com.ec",
    "google.com.eg",
    "google.com.et",
    "google.com.fj",
    "google.com.gh",
    "google.com.gi",
    "google.com.gt",
    "google.com.hk",
    "google.com.jm",
    "google.com.kh",
    "google.com.kw",
    "google.com.lb",
    "google.com.ly",
    "google.com.mm",
    "google.com.mt",
    "google.com.mx",
    "google.com.my",
    "google.com.na",
    "google.com.nf",
    "google.com.ng",
    "google.com.ni",
    "google.com.np",
    "google.com.om",
    "google.com.pa",
    "google.com.pe",
    "google.com.pg",
    "google.com.ph",
    "google.com.pk",
    "google.com.pr",
    "google.com.py",
    "google.com.qa",
    "google.com.sa",
    "google.com.sb",
    "google.com.sg",
    "google.com.sl",
    "google.com.sv",
    "google.com.tj",
    "google.com.tr",
    "google.com.tw",
    "google.com.ua",
    "google.com.uy",
    "google.com.vc",
    "google.com.vn",
    "google.co.ao",
    "google.co.bw",
    "google.co.ck",
    "google.co.cr",
    "google.co.id",
    "google.co.il",
    "google.co.in",
    "google.co.jp",
    "google.co.ke",
    "google.co.kr",
    "google.co.ls",
    "google.co.ma",
    "google.co.mz",
    "google.co.nz",
    "google.co.th",
    "google.co.tz",
    "google.co.ug",
    "google.co.uk",
    "google.co.uz",
    "google.co.ve",
    "google.co.vi",
    "google.co.za",
    "google.co.zm",
    "google.co.zw",
    "google.cv",
    "google.cz",
    "google.de",
    "google.dj",
    "google.dk",
    "google.dm",
    "google.dz",
    "google.ee",
    "google.es",
    "google.fi",
    "google.fm",
    "google.fr",
    "google.ga",
    "google.ge",
    "google.gg",
    "google.gl",
    "google.gm",
    "google.gp",
    "google.gr",
    "google.gy",
    "google.hn",
    "google.hr",
    "google.ht",
    "google.hu",
    "google.ie",
    "google.im",
    "google.iq",
    "google.is",
    "google.it",
    "google.je",
    "google.jo",
    "google.kg",
    "google.ki",
    "google.kz",
    "google.la",
    "google.li",
    "google.lk",
    "google.lt",
    "google.lu",
    "google.lv",
    "google.md",
    "google.me",
    "google.mg",
    "google.mk",
    "google.ml",
    "google.mn",
    "google.ms",
    "google.mu",
    "google.mv",
    "google.mw",
    "google.ne",
    "google.nl",
    "google.no",
    "google.nr",
    "google.nu",
    "google.pl",
    "google.pn",
    "google.ps",
    "google.pt",
    "google.ro",
    "google.rs",
    "google.ru",
    "google.rw",
    "google.sc",
    "google.se",
    "google.sh",
    "google.si",
    "google.sk",
    "google.sm",
    "google.sn",
    "google.so",
    "google.sr",
    "google.st",
    "google.td",
    "google.tg",
    "google.tk",
    "google.tl",
    "google.tm",
    "google.tn",
    "google.to",
    "google.tt",
    "google.vg",
    "google.vu",
    "google.ws",

    "fonts.googleapis.com",
    "storage.googleapis.com",
    "www.googleapis.com",

    "nestpowerproject.withgoogle.com",
  ],
  ["gotomeeting.com", "citrixonline.com"],
  [
    "gray.tv",

    "1011northplatte.com",
    "1011now.com",
    "13abc.com",
    "26nbc.com",
    "abc12.com",
    "blackhillsfox.com",
    "cbs7.com",
    "graydc.com",
    "kalb.com",
    "kbtx.com",
    "kcrg.com",
    "kcwy13.com",
    "kfyrtv.com",
    "kgns.tv",
    "kgwn.tv",
    "kkco11news.com",
    "kktv.com",
    "kmot.com",
    "kmvt.com",
    "knoe.com",
    "knopnews2.com",
    "kolotv.com",
    "kotatv.com",
    "kqcd.com",
    "ksfy.com",
    "ksnblocal4.com",
    "kspr.com",
    "ktuu.com",
    "kumv.com",
    "kwch.com",
    "kwqc.com",
    "kwtx.com",
    "kxii.com",
    "ky3.com",
    "nbc15.com",
    "newsplex.com",
    "thenewscenter.tv",
    "uppermichigansource.com",
    "valleynewslive.com",
    "wabi.tv",
    "wagmtv.com",
    "wbay.com",
    "wbko.com",
    "wcax.com",
    "wcjb.com",
    "wctv.tv",
    "wdbj7.com",
    "wdtv.com",
    "weau.com",
    "webcenter11.com",
    "whsv.com",
    "wibw.com",
    "wifr.com",
    "wilx.com",
    "witn.com",
    "wjhg.com",
    "wkyt.com",
    "wndu.com",
    "wowt.com",
    "wrdw.com",
    "wsaw.com",
    "wsaz.com",
    "wswg.tv",
    "wtok.com",
    "wtvy.com",
    "wvlt.tv",
    "wymt.com",

    "graytvinc.com",
  ],
  ["guardian.co.uk", "guim.co.uk", "guardianapps.co.uk", "theguardian.com", "gu-web.net"],
  [
    "habr.com",
    "habr.ru",
    "habrahabr.ru",
    "freelansim.ru",
    "geektimes.com",
    "geektimes.ru",
    "moikrug.ru",
    "toster.ru",

    "habracdn.net",
    "habrastorage.org",
    "hsto.org",
  ],
  ["healthfusion.com", "healthfusionclaims.com"],
  [
    "hearst.com",

    "beaumontenterprise.com",
    "chron.com",
    "ctnews.com",
    "ctpost.com",
    "dariennewsonline.com",
    "expressnews.com",
    "fairfieldcitizenonline.com",
    "foothillstrader.com",
    "gametimect.com",
    "greenwichtime.com",
    "houstonchronicle.com",
    "lmtonline.com",
    "michigansthumb.com",
    "middletownpress.com",
    "mrt.com",
    "myjournalcourier.com",
    "myplainview.com",
    "mysanantonio.com",
    "newcanaannewsonline.com",
    "newmilfordspectrum.com",
    "newstimes.com",
    "nhregister.com",
    "ourmidland.com",
    "registercitizen.com",
    "seattlepi.com",
    "sfchronicle.com",
    "sfgate.com",
    "stamfordadvocate.com",
    "thehour.com",
    "theintelligencer.com",
    "thetelegraph.com",
    "timesunion.com",
    "westport-news.com",
    "yourconroenews.com",

    "hdnux.com",
  ],
  [
    "houzz.com",

    "houzz.at",
    "houzz.be",
    "houzz.ca",
    "houzz.ch",
    "houzz.co.jp",
    "houzz.com.au",
    "houzz.com.sg",
    "houzz.co.nz",
    "houzz.co.uk",
    "houzz.de",
    "houzz.dk",
    "houzz.es",
    "houzz.fi",
    "houzz.fr",
    "houzz.ie",
    "houzz.in",
    "houzz.it",
    "houzz.jp",
    "houzz.no",
    "houzz.nz",
    "houzz.pt",
    "houzz.ru",
    "houzz.se",
    "houzz.sg",
    "houzz.uk",

    "gardenweb.com",
    "gwhouzz3.com",
    "gwhouzz.com",
    "houzz2.com",
    "houzz2.com.au",
    "houzz2.co.uk",
    "houzz3.com",
    "houzz3.com.au",
    "houzz3.co.uk",
    "hzcdn.com",
    "stghouzz.com",
    "thathomesite.com",
  ],
  ["hvfcu.org", "hvfcuonline.org"],
  ["ign.fr", "geoportail.gouv.fr"],
  ["lnk.to", "tix.to", "tck.to", "ticket.to", "linkfire.com", "assetlab.io", "linkfire.co", "lnkfi.re"],
  ["logmein.com", "logme.in"],
  ["macys.com", "macysassets.com"],
  ["mandtbank.com", "mtb.com"],
  ["mathletics.com", "mathletics.com.au", "mathletics.co.uk"],
  ["mdsol.com", "imedidata.com"],
  ["meetup.com", "meetupstatic.com"],
  ["mercadolivre.com", "mercadolivre.com.br", "mercadolibre.com", "mercadolibre.com.ar", "mercadolibre.com.mx"],
  ["mi.com", "xiaomi.com"],
  [
    "microsoft.com",

    "aspnetcdn.com",
    "azure.com",
    "azureedge.net",
    "azure.net",
    "bing.com",
    "bing.net",
    "dynamics.com",
    "gfx.ms",
    "healthvault.com",
    "hotmail.com",
    "live.com",
    "microsoftonline.com",
    "microsoftstore.com",
    "microsoftstream.com",
    "msn.com",
    "msocdn.com",
    "office365.com",
    "office.com",
    "office.net",
    "onenote.com",
    "onestore.ms",
    "passport.net",
    "sharepoint.com",
    "skypeassets.com",
    "skype.com",
    "s-microsoft.com",
    "visualstudio.com",
    "windowsazure.com",
    "windows.com",
    "xbox.com",
    "xboxlive.com",
    "yammer.com",
  ],
  ["mobilism.org.in", "mobilism.org"],
  ["morganstanley.com", "morganstanleyclientserv.com", "stockplanconnect.com", "ms.com"],
  [
    "mtv.fi",

    "cmore.fi",
    "lumijapyry.fi",
    "luukku.com",
    "mtvuutiset.fi",
    "salatutelamat.fi",
    "studio55.fi",
    "suomiareena.fi",
  ],
  ["my-bookings.org", "my-bookings.cc"],
  ["mycanal.fr", "canal-plus.com"],
  [
    "myheritage.com",

    "myheritageadn.be",
    "myheritageadn.fr",
    "myheritageadn.it",
    "myheritageadn.pt",
    "myheritage.am",
    "myheritage.at",
    "myheritage.be",
    "myheritage.cat",
    "myheritage.ch",
    "myheritage.cn",
    "myheritage.co.il",
    "myheritage.co.in",
    "myheritage.co.kr",
    "myheritage.com.br",
    "myheritage.com.hr",
    "myheritage.com.pt",
    "myheritage.com.tr",
    "myheritage.com.ua",
    "myheritage.cz",
    "myheritage.de",
    "myheritage.dk",
    "myheritagedna.be",
    "myheritagedna.com",
    "myheritagedna.fr",
    "myheritagedna.it",
    "myheritagedna.pt",
    "myheritage.ee",
    "myheritage.es",
    "myheritage.fi",
    "myheritage.fr",
    "myheritage.gr",
    "myheritage.hu",
    "myheritage.it",
    "myheritage.jp",
    "myheritagelibraryedition.com",
    "myheritage.lt",
    "myheritage.lv",
    "myheritage.mk",
    "myheritage.nl",
    "myheritage.no",
    "myheritage.pl",
    "myheritage.pt",
    "myheritage.ro",
    "myheritage.rs",
    "myheritage.se",
    "myheritage.si",
    "myheritage.sk",
    "myheritage.tw",

    "dnaquest.org",
    "familygraph.com",
    "familygraphql.com",
    "familytreebuilder.com",
    "tribalquest.org",

    "mhcache.com",
    "myheritage-container.com",
    "myheritagefiles.com",
    "myheritageimages.com",
  ],
  ["mymerrill.com", "ml.com", "merrilledge.com"],
  ["mynortonaccount.com", "norton.com"],
  ["mysmartedu.com", "mysmartabc.com"],
  ["mysql.com", "oracle.com"],
  ["myuv.com", "uvvu.com"],
  [
    "nbcnews.com",

    "msnbc.com",
    "today.com",

    "newsvine.com",
    "s-nbcnews.com",
  ],
  ["nefcuonline.com", "nefcu.com"],
  ["netflix.com", "nflxext.com", "nflximg.net", "nflxvideo.net"],
  [
    "nettix.fi",

    "nettiauto.com",
    "nettikaravaani.com",
    "nettikone.com",
    "nettimarkkina.com",
    "nettimokki.com",
    "nettimoto.com",
    "nettivaraosa.com",
    "nettivene.com",
    "nettivuokraus.com",
  ],
  ["newegg.com", "neweggbusiness.com", "neweggimages.com", "newegg.ca"],
  [
    "newscorpaustralia.com",

    "1degree.com.au",
    "adelaidenow.com.au",
    "api.news",
    "bestrecipes.com.au",
    "bodyandsoul.com.au",
    "brisbanenews.com.au",
    "cairnspost.com.au",
    "couriermail.com.au",
    "dailytelegraph.com.au",
    "delicious.com.au",
    "escape.com.au",
    "foxsports.com.au",
    "geelongadvertiser.com.au",
    "goldcoastbulletin.com.au",
    "gq.com.au",
    "heraldsun.com.au",
    "homelife.com.au",
    "insideout.com.au",
    "kidspot.com.au",
    "nativeincolour.com.au",
    "newsadds.com.au",
    "newsapi.com.au",
    "newscdn.com.au",
    "news.com.au",
    "news.net.au",
    "newsprestigenetwork.com.au",
    "newsxtend.com.au",
    "nlm.io",
    "ntnews.com.au",
    "supercoach.com.au",
    "taste.com.au",
    "theaustralian.com.au",
    "themercury.com.au",
    "townsvillebulletin.com.au",
    "vogue.com.au",
    "weeklytimesnow.com.au",
    "whereilive.com.au",
    "whimn.com.au",
  ],
  [
    "nintendo.com",
    "nintendo.net",
    "nintendo-europe.com",
    "nintendonyc.com",

    "nintendo.at",
    "nintendo.be",
    "nintendo.ch",
    "nintendo.co.uk",
    "nintendo.co.za",
    "nintendo.de",
    "nintendo.es",
    "nintendo.eu",
    "nintendo.fr",
    "nintendo.it",
    "nintendo.nl",
    "nintendo.pt",
    "nintendo.ru",

    "animal-crossing.com",
    "smashbros.com",
    "zelda.com",
  ],
  ["norsk-tipping.no", "buypass.no"],
  [
    "npo.nl",

    "2doc.nl",
    "3fm.nl",
    "avrotros.nl",
    "bnnvara.nl",
    "brainwash.nl",
    "delagarde.nl",
    "eo.nl",
    "funx.nl",
    "human.nl",
    "jeugdjournaal.nl",
    "joop.nl",
    "kro-ncrv.nl",
    "kro.nl",
    "npo3fm.nl",
    "npo3.nl",
    "npoplus.nl",
    "nporadio1.nl",
    "nporadio2.nl",
    "nporadio4.nl",
    "nporadio5.nl",
    "npostart.nl",
    "ntr.nl",
    "omroep.nl",
    "powned.tv",
    "publiekeomroep.nl",
    "radio4.nl",
    "schooltv.nl",
    "vara.nl",
    "vpro.nl",
    "zappelin.nl",
    "zapp.nl",
  ],
  ["nymag.com", "vulture.com", "grubstreet.com"],
  [
    "nypublicradio.org",

    "newsounds.org",
    "radiolab.org",
    "thegreenespace.org",
    "wnycstudios.org",
    "wqxr.org",

    "wnyc.org",
  ],
  ["nytimes.com", "newyorktimes.com", "nyt.com"],
  ["nyu.edu", 
   
   "mediacommons.org",
   "nyupress.org",
   ],
  [
    "nvidia.com",

    "nvidia.at",
    "nvidia.be",
    "nvidia.ch",
    "nvidia.co.at",
    "nvidia.co.in",
    "nvidia.co.jp",
    "nvidia.co.kr",
    "nvidia.com.au",
    "nvidia.com.br",
    "nvidia.com.mx",
    "nvidia.com.pe",
    "nvidia.com.pl",
    "nvidia.com.tr",
    "nvidia.com.tw",
    "nvidia.com.ua",
    "nvidia.com.ve",
    "nvidia.co.uk",
    "nvidia.cz",
    "nvidia.de",
    "nvidia.dk",
    "nvidia.es",
    "nvidia.eu",
    "nvidia.fi",
    "nvidia.fr",
    "nvidia.in",
    "nvidia.it",
    "nvidia.jp",
    "nvidia.lu",
    "nvidia.mx",
    "nvidia.nl",
    "nvidia.no",
    "nvidia.pl",
    "nvidia.ro",
    "nvidia.ru",
    "nvidia.se",
    "nvidia.tw",

    "geforce.com",
    "geforce.cn",
    "geforce.co.uk",
  ],
  ["onlineatnsb.com", "norwaysavingsbank.com"],
  ["openstreetmap.org", "osmfoundation.org"],
  ["orange.fr", "sosh.fr", "woopic.com"],
  [
    "osf.io",

    "agrixiv.org",
    "arabixiv.org",
    "eartharxiv.org",
    "ecsarxiv.org",
    "engrxiv.org",
    "frenxiv.org",
    "marxiv.org",
    "mindrxiv.org",
    "paleorxiv.org",
    "psyarxiv.com",
    "thesiscommons.org"
  ],
  [
    "ovh.com",

    "kimsufi.com",
    "ovhcloud.com",
    "ovhtelecom.fr",
    "soyoustart.com",

    "ovh.com.au",
    "ovh.co.uk",
    "ovh.cz",
    "ovh.de",
    "ovh.es",
    "ovh-hosting.fi",
    "ovh.ie",
    "ovh.it",
    "ovh.lt",
    "ovh.nl",
    "ovh.pl",
    "ovh.pt",
    "ovh.sn",

    "ovh.net",
  ],
  ["paypal.com", "paypal-search.com"],
  ["pcworld.com", "staticworld.net", "idg.com", "idg.net", "infoworld.com", "macworld.com", "techhive.com", "idg.tv"],
  ["pepco.com", "pepcoholdings.com"],
  ["philips.com", "philips.nl"],
  [
    "pinterest.com",

    "pinterest.at",
    "pinterest.be",
    "pinterest.ca",
    "pinterest.ch",
    "pinterest.cl",
    "pinterest.co",
    "pinterest.co.at",
    "pinterest.co.in",
    "pinterest.co.kr",
    "pinterest.com.au",
    "pinterest.com.bo",
    "pinterest.com.ec",
    "pinterest.com.mx",
    "pinterest.com.pe",
    "pinterest.com.py",
    "pinterest.com.uy",
    "pinterest.com.vn",
    "pinterest.co.nz",
    "pinterest.co.uk",
    "pinterest.de",
    "pinterest.dk",
    "pinterest.ec",
    "pinterest.engineering",
    "pinterest.es",
    "pinterest.fr",
    "pinterest.hu",
    "pinterest.id",
    "pinterest.ie",
    "pinterest.in",
    "pinterest.info",
    "pinterest.it",
    "pinterest.jp",
    "pinterest.kr",
    "pinterestmail.com",
    "pinterest.mx",
    "pinterest.nz",
    "pinterest.pe",
    "pinterest.ph",
    "pinterest.pt",
    "pinterest.ru",
    "pinterest.se",
    "pinterest.th",
    "pinterest.tw",
    "pinterest.uk",
    "pinterest.vn",

    "pinimg.com",
    "pin.it",
  ],
  ["playstation.com", "sonyentertainmentnetwork.com"],
  ["pokemon-gl.com", "pokemon.com"],
  ["pornhub.com", "phncdn.com"],
  ["postepay.it", "poste.it"],
  ["postimees.ee", "city24.ee", "city24.lv", "pmo.ee"],
  [
    "pricerunner.com",

    "pricerunner.co.uk",
    "pricerunner.de",
    "pricerunner.dk",
    "pricerunner.net",
    "pricerunner.se",
    "pricerunner.uk",
  ],
  [
    "qantas.com",

    "jetstar.com",
    "qantas.com.au",
    "qantascourier.com.au",
    "qantasfutureplanet.com.au",
    "qantasgrouptravel.com",
    "qfcrew.com",
    "qfflightcrew.com",

    "aquire.com.au",
    "qantasassure.com",
    "qantasbusinessrewards.com",
    "qantasbusinessrewards.com.au",
    "qantasepiqure.com",
    "qantasepiqure.com.au",
    "qantasgolfclub.com",
    "qantasgolfclub.com.au",
    "qantasloyalty.com",
    "qantasloyalty.net",
    "qantasmall.com",
    "qantasmall.com.au",
    "qantasmall.co.nz",
    "qantaspoints.com",
    "qantaspoints.com.au",
    "qantasshopping.com",
    "qantasshopping.com.au",
    "qantasshopping.co.nz",
    "qantasstore.com.au",
    "qantasstore.co.nz",
    "redplanetgroup.com.au",
    "redplanetportal.com.au",

    "qantascash.com",
    "qantascash.com.au",
    "qantasmoney.com",
    "qantastravelmoney.com",
  ],
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
  [
    "realestate.com.au",

    "property.com.au",
    "realcommercial.com.au",
    "spacely.com.au",

    "reastatic.net",
  ],
  ["reddit.com", "redditmedia.com", "redditstatic.com", "redd.it", "redditenhancementsuite.com", "reddituploads.com", "imgur.com"],
  [
    "reuters.com",
    "reuters.tv",
    "reutersmedia.net",
    "thomsonreuters.com",

    "reutersagency.cn",

    "thomsonreuters.ca",
    "thomsonreuters.cn",
    "thomsonreuters.co.jp",
    "thomsonreuters.co.kr",
    "thomsonreuters.com.ar",
    "thomsonreuters.com.au",
    "thomsonreuters.com.br",
    "thomsonreuters.com.hk",
    "thomsonreuters.com.my",
    "thomsonreuters.com.pe",
    "thomsonreuters.com.sg",
    "thomsonreuters.com.tr",
    "thomsonreuters.co.uk",
    "thomsonreuters.es",
    "thomsonreuters.in",
    "thomsonreuters.ru",
  ],
  [
    "s-kanava.fi",

    "abcasemat.fi",
    "raflaamo.fi",
    "s-mobiili.fi",
    "sokoshotels.fi",
    "yhteishyva.fi",

    "sok.fi",
    "s-palvelut.fi",
  ],
  [
    "salesforce.com",

    "einstein.com",
    "force.com",
    "pardot.com",
    "salesforceliveagent.com",
  ],
  ["sanguosha.com", "bianfeng.com"],
  ["schwab.com", "schwabplan.com"],
  ["sears.com", "shld.net"],
  ["shopify.com", "myshopify.com"],
  ["siriusxm.com", "sirius.com"],
  ["skygo.co.nz", "skytv.co.nz"],
  ["skysports.com", "skybet.com", "skyvegas.com"],
  ["slashdot.org", "sourceforge.net", "fsdn.com"],
  ["slickdeals.net", "slickdealscdn.com"],
  ["snapfish.com", "snapfish.ca"],
  ["sony.com", "sonyrewards.com"],
  ["soundcu.com", "netteller.com"],
  ["southerncompany.com", "southernco.com"],
  ["southparkstudios.com", "cc.com", "comedycentral.com"],
  [
    "spotify.com",

    "scdn.co",
    "spotifyforbrands.com",
    "spotifyforartists.com",
    "spotify.net",
  ],
  [
    "springernature.com",

    "adis.com",
    "apress.com",
    "biomedcentral.com",
    "bsl.nl",
    "dgim-eakademie.de",
    "kardiologie.org",
    "macmillaneducation.com",
    "macmillanexplorers.com",
    "medengine.com",
    "medicinematters.com",
    "medicinematters.in",
    "medwirenews.com",
    "metzlerverlag.de",
    "nature.com",
    "natureindex.com",
    "palgrave.com",
    "scientificamerican.com",
    "springer.com",
    "springeraesthetik.de",
    "springerhealthcare.com",
    "springermedizin.at",
    "springermedizin.de",
    "springeropen.com",
    "springerpflege.de",
    "springerprofessional.de",
  ],
  ["sprint.com", "sprintpcs.com", "nextel.com"],
  ["squareup.com", "cash.app", "mkt.com", "squarecdn.com"],
  ["steampowered.com", "steamstatic.com", "steamcommunity.com"],
  ["taobao.com", "alicdn.net", "tmail.com", "tbcdn.cn", "alibaba.com",
    "aliexpress.com", "tmall.com", "alimama.com", "1688.com", "aliyun.com", "www.net.cn"],
  ["techdata.com", "techdata.ch"],
  ["telegram.org", "telegram.me", "t.me"],
  ["telekom.com", "t-online.de"],
  ["tesla.com", "teslamotors.com"],
  [
    "toyota.com",

    "lexus.com",

    "toyota.am",
    "toyota.at",
    "toyota.az",
    "toyota.ba",
    "toyota.be",
    "toyota.bg",
    "toyota-canarias.es",
    "toyotacg.me",
    "toyota.ch",
    "toyota.co.il",
    "toyota.com.cy",
    "toyota.com.mk",
    "toyota.com.mt",
    "toyota.com.tr",
    "toyota.co.uk",
    "toyota.cz",
    "toyota.de",
    "toyota.dk",
    "toyota.ee",
    "toyota.es",
    "toyota.fi",
    "toyota.fr",
    "toyota.ge",
    "toyota-gib.com",
    "toyota.gr",
    "toyota.hr",
    "toyota.hu",
    "toyota.ie",
    "toyota.is",
    "toyota.it",
    "toyota-kosovo.com",
    "toyota.kz",
    "toyota.lt",
    "toyota.lu",
    "toyota.lv",
    "toyota.md",
    "toyota.nl",
    "toyota.no",
    "toyota.pl",
    "toyota.pt",
    "toyota.ro",
    "toyota.rs",
    "toyota.ru",
    "toyota.se",
    "toyota.si",
    "toyota.sk",
    "toyota.ua",

    "toyota-europe.com",
  ],
  [
    "tripadvisor.com",

    "tripadvisor.at",
    "tripadvisor.be",
    "tripadvisor.ca",
    "tripadvisor.ch",
    "tripadvisor.co.hu",
    "tripadvisor.co.id",
    "tripadvisor.com.ar",
    "tripadvisor.com.au",
    "tripadvisor.com.br",
    "tripadvisor.com.gr",
    "tripadvisor.com.hk",
    "tripadvisor.com.mx",
    "tripadvisor.com.my",
    "tripadvisor.com.pe",
    "tripadvisor.com.ph",
    "tripadvisor.com.sg",
    "tripadvisor.com.tr",
    "tripadvisor.com.tw",
    "tripadvisor.co.nz",
    "tripadvisor.co.uk",
    "tripadvisor.co.za",
    "tripadvisor.de",
    "tripadvisor.dk",
    "tripadvisor.es",
    "tripadvisor.fi",
    "tripadvisor.fr",
    "tripadvisor.ie",
    "tripadvisor.in",
    "tripadvisor.it",
    "tripadvisor.jp",
    "tripadvisor.nl",
    "tripadvisor.pt",
    "tripadvisor.ru",
    "tripadvisor.se",
    "tripadvisor.sk",

    "tacdn.com",
    "tamgrt.com",
  ],
  [
    "trivago.com",

    "trivago.ae",
    "trivago.at",
    "trivago.be",
    "trivago.bg",
    "trivago.ca",
    "trivago.ch",
    "trivago.cl",
    "trivago.co.id",
    "trivago.co.il",
    "trivago.co.kr",
    "trivago.com.ar",
    "trivago.com.au",
    "trivago.com.br",
    "trivago.com.co",
    "trivago.com.ec",
    "trivago.com.mx",
    "trivago.com.my",
    "trivago.com.ph",
    "trivago.com.tr",
    "trivago.com.tw",
    "trivago.com.uy",
    "trivago.co.nz",
    "trivago.co.th",
    "trivago.co.uk",
    "trivago.co.za",
    "trivago.cz",
    "trivago.dk",
    "trivago.es",
    "trivago.fi",
    "trivago.fr",
    "trivago.gr",
    "trivago.hk",
    "trivago.hr",
    "trivago.hu",
    "trivago.ie",
    "trivago.in",
    "trivago.it",
    "trivago.jp",
    "trivago.nl",
    "trivago.no",
    "trivago.pe",
    "trivago.pl",
    "trivago.pt",
    "trivago.ro",
    "trivago.rs",
    "trivago.ru",
    "trivago.se",
    "trivago.sg",
    "trivago.si",
    "trivago.sk",
    "trivago.vn",
    "youzhan.com",
  ],
  ["trsretire.com", "divinvest.com"],
  ["turbotax.com", "intuit.com"],
  ["twitch.tv", "ttvnw.net", "jtvnw.net"],
  ["twitter.com", "twimg.com", "t.co"],
  ["ua2go.com", "ual.com", "united.com", "unitedwifi.com"],
  ["ubisoft.com", "ubi.com", "anno-union.com", "thesettlers-alliance.com"],
  ["verizon.com", "verizon.net", "verizonwireless.com", "vzw.com"],
  [
    "vinted.com",

    "kleiderkreisel.de",
    "mamikreisel.de",

    "vinted.co.uk",
    "vinted.cz",
    "vinted.es",
    "vinted.fr",
    "vinted.lt",
    "vinted.nl",
    "vinted.pl",
  ],
  ["vk.com", "vk.me", "vkontakte.ru"],
  ["volkskrant.nl", "persgroep.net", "persgroep.nl", "parool.nl"],
  ["volvooceanrace.com", "virtualregatta.com"],
  ["vonage.com", "vonagebusiness.com"],
  ["walmart.com", "wal.co", "walmartimages.com", "walmart.ca"],
  [
    "webmd.com",

    "emedicinehealth.com",
    "medicinenet.com",
    "medscape.com",
    "medscape.org",
    "onhealth.com",
    "rxlist.com",

    "medscapestatic.com",
  ],
  ["weebly.com", "editmysite.com"],
  ["wellsfargo.com", "wf.com"],
  ["wetter.com", "tiempo.es", "wettercomassets.com"],
  ["wikipedia.org", "wikimedia.org", "wikimediafoundation.org", "wiktionary.org",
    "wikiquote.org", "wikibooks.org", "wikisource.org", "wikinews.org",
    "wikiversity.org", "mediawiki.org", "wikidata.org", "wikivoyage.org"],
  ["wix.com", "wixapps.net", "wixstatic.com", "parastorage.com"],
  ["wordpress.com", "wp.com"],
  [
    "wp.pl",

    "abczdrowie.pl",
    "allani.pl",
    "autokult.pl",
    "dobreprogramy.pl",
    "domodi.pl",
    "eholiday.pl",
    "finansowysupermarket.pl",
    "fotoblogia.pl",
    "gadzetomania.pl",
    "homebook.pl",
    "jedenwniosek.pl",
    "komorkomania.pl",
    "money.pl",
    "nocowanie.pl",
    "o2.pl",
    "open.fm",
    "parenting.pl",
    "pudelek.pl",
    "pudelek.tv",
    "totalmoney.pl",
    "wakacje.pl",
    "wawalove.pl",
    "wp.tv",

    "wpcdn.pl",
    "wpimg.pl",
  ],
  ["wpcu.coop", "wpcuonline.com"],
  ["wsj.com", "wsj.net", "barrons.com", "dowjones.com", "marketwatch.com"],
  ["xda-developers.com", "xda-cdn.com"],
  ["xfinity.com", "comcast.net", "comcast.com"],
  ["xiami.com", "alipay.com"],
  ["yahoo.com", "yahooapis.com", "yimg.com", "yahoo.co.jp", "overture.com", "flickr.com"],
  [
    "yandex.com",

    "auto.ru",
    "beru.ru",
    "kinopoisk.ru",
    "mykp.ru",

    "yandex.net",
    "ya.ru",
    "yastatic.net",

    "yandex.az",
    "yandex.by",
    "yandex.co.il",
    "yandex.com",
    "yandex.com.ge",
    "yandex.com.tr",
    "yandex.ee",
    "yandex.fr",
    "yandex.kg",
    "yandex.kz",
    "yandex.lt",
    "yandex.lv",
    "yandex.md",
    "yandex.ru",
    "yandex.tj",
    "yandex.tm",
    "yandex.ua",
    "yandex.uz",
  ],
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

let _domainLookup = makeDomainLookup(multiDomainFirstPartiesArray);
/**
 * Check if two domains belong to the same effective first party
 * @param {String} domain1 a base doamin
 * @param {String} domain2 a second base doamin
 *
 * @return boolean true if the domains are the same first party
 */
let isMultiDomainFirstParty = makeIsMultiDomainFirstParty(_domainLookup);
/************************************** exports */
return {
  isMultiDomainFirstParty,
  makeDomainLookup,
  makeIsMultiDomainFirstParty,
  multiDomainFirstPartiesArray,
};
})(); //require scopes
