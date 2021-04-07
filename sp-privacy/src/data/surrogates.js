/*
 *
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2016 Electronic Frontier Foundation
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

require.scopes.surrogatedb = (function() {

/**
 * A hostname can have one or more surrogate scripts.
 *
 * "hostnames" maps hostnames to surrogate pattern tokens.
 *
 * Surrogate pattern tokens are used to look up the actual
 * surrogate script code (stored in "surrogates" object below).
 *
 * There are currently two types of surrogate pattern tokens:
 *
 * - {Array} one or more suffix tokens:
 *   Does the script URL (querystring excluded) end with the token?
 *
 * - {String} wildcard token:
 *   Matches any script URL for the hostname.
 */
const hostnames = {
  'b.scorecardresearch.com': [
    '/beacon.js',
    '/c2/plugins/streamsense_plugin_html5.js',
  ],
  'sb.scorecardresearch.com': [
    '/beacon.js',
    '/c2/plugins/streamsense_plugin_html5.js',
  ],
  'ssl.google-analytics.com': [
    '/ga.js',
    '/analytics.js',
  ],
  'www.google-analytics.com': [
    '/analytics.js',
    '/ga.js',
  ],
  'www.googletagservices.com': [
    '/gpt.js',
  ],
  'api.youneeq.ca': [
    '/app/yqmin',
  ],
  'cdn.krxd.net': 'noopjs',
  'widgets.outbrain.com': '/outbrain.js',
};

/**
 * "surrogates" maps surrogate pattern tokens to surrogate script code.
 */
const surrogates = {
  /* eslint-disable no-extra-semi, space-in-parens */

  // Google Analytics (legacy ga.js)
  //
  // sourced from https://github.com/uBlockOrigin/uAssets/ under GPLv3
  // https://github.com/uBlockOrigin/uAssets/blob/2dfeece7cfe671e93573db6d176901cf2df37623/filters/resources.txt#L162-L260
  //
  // test cases:
  // http://checkin.avianca.com/
  // https://www.vmware.com/support/pubs/ws_pubs.html (release notes links)
  //
  // API reference:
  // https://developers.google.com/analytics/devguides/collection/gajs/methods/
  '/ga.js': '(' +
    function() {
      var noopfn = function() {
        ;
      };
      //
      var Gaq = function() {
        ;
      };
      Gaq.prototype.Na = noopfn;
      Gaq.prototype.O = noopfn;
      Gaq.prototype.Sa = noopfn;
      Gaq.prototype.Ta = noopfn;
      Gaq.prototype.Va = noopfn;
      Gaq.prototype._createAsyncTracker = noopfn;
      Gaq.prototype._getAsyncTracker = noopfn;
      Gaq.prototype._getPlugin = noopfn;
      Gaq.prototype.push = function(a) {
        if ( typeof a === 'function' ) {
          a(); return;
        }
        if ( Array.isArray(a) === false ) {
          return;
        }
        // https://twitter.com/catovitch/status/776442930345218048
        // https://developers.google.com/analytics/devguides/collection/gajs/methods/gaJSApiDomainDirectory#_gat.GA_Tracker_._link
        if ( a[0] === '_link' && typeof a[1] === 'string' ) {
          window.location.assign(a[1]);
        }
        // https://github.com/gorhill/uBlock/issues/2162
        if ( a[0] === '_set' && a[1] === 'hitCallback' && typeof a[2] === 'function' ) {
          a[2]();
        }
      };
      //
      var tracker = (function() {
        var out = {};
        var api = [
          '_addIgnoredOrganic _addIgnoredRef _addItem _addOrganic',
          '_addTrans _clearIgnoredOrganic _clearIgnoredRef _clearOrganic',
          '_cookiePathCopy _deleteCustomVar _getName _setAccount',
          '_getAccount _getClientInfo _getDetectFlash _getDetectTitle',
          '_getLinkerUrl _getLocalGifPath _getServiceMode _getVersion',
          '_getVisitorCustomVar _initData _link _linkByPost',
          '_setAllowAnchor _setAllowHash _setAllowLinker _setCampContentKey',
          '_setCampMediumKey _setCampNameKey _setCampNOKey _setCampSourceKey',
          '_setCampTermKey _setCampaignCookieTimeout _setCampaignTrack _setClientInfo',
          '_setCookiePath _setCookiePersistence _setCookieTimeout _setCustomVar',
          '_setDetectFlash _setDetectTitle _setDomainName _setLocalGifPath',
          '_setLocalRemoteServerMode _setLocalServerMode _setReferrerOverride _setRemoteServerMode',
          '_setSampleRate _setSessionTimeout _setSiteSpeedSampleRate _setSessionCookieTimeout',
          '_setVar _setVisitorCookieTimeout _trackEvent _trackPageLoadTime',
          '_trackPageview _trackSocial _trackTiming _trackTrans',
          '_visitCode'
        ].join(' ').split(/\s+/);
        var i = api.length;
        while ( i-- ) {
          out[api[i]] = noopfn;
        }
        out._getLinkerUrl = function(a) {
          return a;
        };
        return out;
      })();
      //
      var Gat = function() {
        ;
      };
      Gat.prototype._anonymizeIP = noopfn;
      Gat.prototype._createTracker = noopfn;
      Gat.prototype._forceSSL = noopfn;
      Gat.prototype._getPlugin = noopfn;
      Gat.prototype._getTracker = function() {
        return tracker;
      };
      Gat.prototype._getTrackerByName = function() {
        return tracker;
      };
      Gat.prototype._getTrackers = noopfn;
      Gat.prototype.aa = noopfn;
      Gat.prototype.ab = noopfn;
      Gat.prototype.hb = noopfn;
      Gat.prototype.la = noopfn;
      Gat.prototype.oa = noopfn;
      Gat.prototype.pa = noopfn;
      Gat.prototype.u = noopfn;
      var gat = new Gat();
      window._gat = gat;
      //
      var gaq = new Gaq();
      (function() {
        var aa = window._gaq || [];
        if ( Array.isArray(aa) ) {
          while ( aa[0] ) {
            gaq.push(aa.shift());
          }
        }
      })();
      window._gaq = gaq.qf = gaq;
    } + ')();',

  // https://github.com/gorhill/uBlock/issues/1265
  // https://github.com/uBlockOrigin/uAssets/blob/581f2c93eeca0e55991aa331721b6942f3162615/filters/resources.txt#L736-L746
  /* eslint-disable no-undef */
  '/beacon.js': '(' +
    function() {
      window.COMSCORE = {
        purge: function() {
          _comscore = [];
        },
        beacon: function() {
          ;
        }
      };
    } + ')();',
  /* eslint-enable no-undef */

  // http://www.dplay.se/ett-jobb-for-berg/ (videos)
  '/c2/plugins/streamsense_plugin_html5.js': '(' +
    function() {
    } + ')();',

  // https://github.com/EFForg/privacybadger/issues/993
  // https://github.com/uBlockOrigin/uAssets/blob/2bc97541b3b9a9380b3ce8bd2242375925df293c/filters/resources.txt#L436-L567
  /* eslint-disable no-empty */
  '/gpt.js': '(' +
    function() {
      var p;
      // https://developers.google.com/doubleclick-gpt/reference
      var noopfn = function() {
        ;
      }.bind();
      var noopthisfn = function() {
        return this;
      };
      var noopnullfn = function() {
        return null;
      };
      var nooparrayfn = function() {
        return [];
      };
      var noopstrfn = function() {
        return '';
      };
      //
      var companionAdsService = {
        addEventListener: noopthisfn,
        enableSyncLoading: noopfn,
        setRefreshUnfilledSlots: noopfn
      };
      var contentService = {
        addEventListener: noopthisfn,
        setContent: noopfn
      };
      var PassbackSlot = function() {
        ;
      };
      p = PassbackSlot.prototype;
      p.display = noopfn;
      p.get = noopnullfn;
      p.set = noopthisfn;
      p.setClickUrl = noopthisfn;
      p.setTagForChildDirectedTreatment = noopthisfn;
      p.setTargeting = noopthisfn;
      p.updateTargetingFromMap = noopthisfn;
      var pubAdsService = {
        addEventListener: noopthisfn,
        clear: noopfn,
        clearCategoryExclusions: noopthisfn,
        clearTagForChildDirectedTreatment: noopthisfn,
        clearTargeting: noopthisfn,
        collapseEmptyDivs: noopfn,
        defineOutOfPagePassback: function() { return new PassbackSlot(); },
        definePassback: function() { return new PassbackSlot(); },
        disableInitialLoad: noopfn,
        display: noopfn,
        enableAsyncRendering: noopfn,
        enableSingleRequest: noopfn,
        enableSyncRendering: noopfn,
        enableVideoAds: noopfn,
        get: noopnullfn,
        getAttributeKeys: nooparrayfn,
        getTargeting: noopfn,
        getTargetingKeys: nooparrayfn,
        getSlots: nooparrayfn,
        refresh: noopfn,
        set: noopthisfn,
        setCategoryExclusion: noopthisfn,
        setCentering: noopfn,
        setCookieOptions: noopthisfn,
        setForceSafeFrame: noopthisfn,
        setLocation: noopthisfn,
        setPublisherProvidedId: noopthisfn,
        setRequestNonPersonalizedAds: noopthisfn,
        setSafeFrameConfig: noopthisfn,
        setTagForChildDirectedTreatment: noopthisfn,
        setTargeting: noopthisfn,
        setVideoContent: noopthisfn,
        updateCorrelator: noopfn
      };
      var SizeMappingBuilder = function() {
        ;
      };
      p = SizeMappingBuilder.prototype;
      p.addSize = noopthisfn;
      p.build = noopnullfn;
      var Slot = function() {
        ;
      };
      p = Slot.prototype;
      p.addService = noopthisfn;
      p.clearCategoryExclusions = noopthisfn;
      p.clearTargeting = noopthisfn;
      p.defineSizeMapping = noopthisfn;
      p.get = noopnullfn;
      p.getAdUnitPath = nooparrayfn;
      p.getAttributeKeys = nooparrayfn;
      p.getCategoryExclusions = nooparrayfn;
      p.getDomId = noopstrfn;
      p.getSlotElementId = noopstrfn;
      p.getSlotId = noopthisfn;
      p.getTargeting = nooparrayfn;
      p.getTargetingKeys = nooparrayfn;
      p.set = noopthisfn;
      p.setCategoryExclusion = noopthisfn;
      p.setClickUrl = noopthisfn;
      p.setCollapseEmptyDiv = noopthisfn;
      p.setTargeting = noopthisfn;
      //
      var gpt = window.googletag || {};
      var cmd = gpt.cmd || [];
      gpt.apiReady = true;
      gpt.cmd = [];
      gpt.cmd.push = function(a) {
        try {
          a();
        } catch (ex) {
        }
        return 1;
      };
      gpt.companionAds = function() { return companionAdsService; };
      gpt.content = function() { return contentService; };
      gpt.defineOutOfPageSlot = function() { return new Slot(); };
      gpt.defineSlot = function() { return new Slot(); };
      gpt.destroySlots = noopfn;
      gpt.disablePublisherConsole = noopfn;
      gpt.display = noopfn;
      gpt.enableServices = noopfn;
      gpt.getVersion = noopstrfn;
      gpt.pubads = function() { return pubAdsService; };
      gpt.pubadsReady = true;
      gpt.setAdIframeTitle = noopfn;
      gpt.sizeMapping = function() { return new SizeMappingBuilder(); };
      window.googletag = gpt;
      while ( cmd.length !== 0 ) {
        gpt.cmd.push(cmd.shift());
      }
    } + ')();',
  /* eslint-enable no-empty */

  // https://github.com/EFForg/privacybadger/issues/1014
  /* eslint-disable no-unused-expressions */
  '/app/yqmin': '(' +
    function() {
      var noopfn = function() {
        ;
      };
      function YqClass() {
        this.observe = noopfn;
        this.observeMin = noopfn;
        this.scroll_event = noopfn;
        this.onready = noopfn;
        this.yq_panel_click = noopfn;
        this.titleTrim = noopfn;
      }
      window.Yq || (window.Yq = new YqClass);
    } + ')();',
  /* eslint-enable no-unused-expressions */

  // https://github.com/uBlockOrigin/uAssets/blob/0e225402b40db0983faf8b4ce13c73d57fb257d7/filters/resources.txt#L354-L403
  /* eslint-disable no-empty */
  '/analytics.js': '(' +
    function() {
      // https://developers.google.com/analytics/devguides/collection/analyticsjs/
      var noopfn = function() {
        ;
      };
      var noopnullfn = function() {
        return null;
      };
      //
      var Tracker = function() {
        ;
      };
      var p = Tracker.prototype;
      p.get = noopfn;
      p.set = noopfn;
      p.send = noopfn;
      //
      var w = window,
        gaName = w.GoogleAnalyticsObject || 'ga';
      var ga = function() {
        var len = arguments.length;
        if ( len === 0 ) {
          return;
        }
        var f = arguments[len-1];
        if ( typeof f !== 'object' || f === null || typeof f.hitCallback !== 'function' ) {
          return;
        }
        try {
          f.hitCallback();
        } catch (ex) {
        }
      };
      ga.create = function() {
        return new Tracker();
      };
      ga.getByName = noopnullfn;
      ga.getAll = function() {
        return [];
      };
      ga.remove = noopfn;
      // https://github.com/uBlockOrigin/uAssets/issues/2107
      ga.loaded = true;
      w[gaName] = ga;
      // https://github.com/gorhill/uBlock/issues/3075
      var dl = w.dataLayer;
      if ( dl instanceof Object && dl.hide instanceof Object && typeof dl.hide.end === 'function' ) {
        dl.hide.end();
      }
    } + ')();',
  /* eslint-enable no-empty */

  // https://github.com/uBlockOrigin/uAssets/blob/d7d4836638dcf227938b4cead66ad9d01b6166ba/filters/resources.txt#L843-L868
  '/outbrain.js': '(' +
    function() {
      var noopfn = function() {
        ;
      };
      var obr = {};
      var methods = [
        'callClick', 'callLoadMore', 'callRecs', 'callUserZapping',
        'callWhatIs', 'cancelRecommendation', 'cancelRecs', 'closeCard',
        'closeModal', 'closeTbx', 'errorInjectionHandler', 'getCountOfRecs',
        'getStat', 'imageError', 'manualVideoClicked', 'onOdbReturn',
        'onVideoClick', 'pagerLoad', 'recClicked', 'refreshSpecificWidget',
        'refreshWidget', 'reloadWidget', 'researchWidget', 'returnedError',
        'returnedHtmlData', 'returnedIrdData', 'returnedJsonData', 'scrollLoad',
        'showDescription', 'showRecInIframe', 'userZappingMessage', 'zappingFormAction'
      ];
      obr.extern = {
        video: {
          getVideoRecs: noopfn,
          videoClicked: noopfn
        }
      };
      methods.forEach(function(a) {
        obr.extern[a] = noopfn;
      });
      window.OBR = window.OBR || obr;
    } + ')();',

  // https://github.com/uBlockOrigin/uAssets/blob/0efcadb2ecc2a9f0daa5a1df79841d794b83860f/filters/resources.txt#L38-L41
  'noopjs': '(' +
    function() {
      ;
    } + ')();',

  /* eslint-enable no-extra-semi, space-in-parens */
};

// aliases
// for example:
// surrogates['/JS/socialize.js'] = surrogates['/JS/gigya.js'] = surrogates['/js/gigya.js'];

// reformat surrogate strings to exactly match formatting in uAssets
Object.keys(surrogates).forEach(key => {
  surrogates[key] = surrogates[key]
    // remove space from anon function if present
    .replace(/^\(function \(/, '(function(')
    // fix indentation
    .split(/[\r\n]/).map(str => str.replace(/^ {4}/, '')).join('\n')
    // replace spaces by tabs
    .replace(/ {2}/g, '\t');
});

const exports = {
  hostnames: hostnames,
  surrogates: surrogates,
};

return exports;
})();
