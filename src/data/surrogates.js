/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

require.scopes.surrogatedb = (function () {

const MATCH_SUFFIX = 'suffix',
  MATCH_ANY = 'any';

/**
 * `hostnames` maps hostnames to surrogate pattern tokens.
 *
 * Surrogate pattern tokens are used to look up the actual
 * surrogate script code (stored in "surrogates" object below).
 */
const hostnames = {
  'b.scorecardresearch.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/beacon.js',
      '/c2/plugins/streamsense_plugin_html5.js',
    ]
  },
  'sb.scorecardresearch.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/beacon.js',
      '/c2/plugins/streamsense_plugin_html5.js',
    ]
  },
  'ssl.google-analytics.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/ga.js',
      '/analytics.js',
    ]
  },
  'www.google-analytics.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/analytics.js',
      '/ga.js',
    ]
  },
  'www.googletagservices.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/gpt.js',
    ]
  },
  'securepubads.g.doubleclick.net': {
    match: MATCH_SUFFIX,
    tokens: [
      '/tag/js/gpt.js',
    ]
  },
  'api.youneeq.ca': {
    match: MATCH_SUFFIX,
    tokens: [
      '/app/yqmin',
    ]
  },
  'cdn.krxd.net': {
    match: MATCH_ANY,
    token: 'noopjs'
  },
  'widgets.outbrain.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/outbrain.js'
    ],
  },
};

/**
 * "surrogates" maps surrogate pattern tokens to surrogate script code.
 */
const surrogates = {
  /* eslint-disable no-extra-semi, space-in-parens */

  // Google Analytics (legacy ga.js)
  //
  // https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/google-analytics_ga.js
  //
  // test cases:
  // http://checkin.avianca.com/
  // https://www.vmware.com/support/pubs/ws_pubs.html (release notes links)
  //
  // API reference:
  // https://developers.google.com/analytics/devguides/collection/gajs/methods/
  '/ga.js': '(' +
    function() {
      'use strict';
      const noopfn = function() {
      };
      //
      const Gaq = function() {
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
      const tracker = (function() {
        const out = {};
        const api = [
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
        let i = api.length;
        while ( i-- ) {
          out[api[i]] = noopfn;
        }
        out._getLinkerUrl = function(a) {
          return a;
        };
        return out;
      })();
      //
      const Gat = function() {
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
      const gat = new Gat();
      window._gat = gat;
      //
      const gaq = new Gaq();
      (function() {
        const aa = window._gaq || [];
        if ( Array.isArray(aa) ) {
          while ( aa[0] ) {
            gaq.push(aa.shift());
          }
        }
      })();
      window._gaq = gaq.qf = gaq;
    } + ')();',

  // https://github.com/gorhill/uBlock/issues/1265
  // https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/scorecardresearch_beacon.js
  /* eslint-disable no-undef */
  '/beacon.js': '(' +
    function() {
      'use strict';
      window.COMSCORE = {
        purge: function() {
          window._comscore = [];
        },
        beacon: function() {
        }
      };
    } + ')();',
  /* eslint-enable no-undef */

  // http://www.dplay.se/ett-jobb-for-berg/ (videos)
  '/c2/plugins/streamsense_plugin_html5.js': '(' +
    function() {
    } + ')();',

  // https://github.com/EFForg/privacybadger/issues/993
  // https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/googletagservices_gpt.js
  /* eslint-disable no-empty */
  '/gpt.js': '(' +
    function() {
      'use strict';
      // https://developers.google.com/doubleclick-gpt/reference
      const noopfn = function() {
      }.bind();
      const noopthisfn = function() {
        return this;
      };
      const noopnullfn = function() {
        return null;
      };
      const nooparrayfn = function() {
        return [];
      };
      const noopstrfn = function() {
        return '';
      };
      //
      const companionAdsService = {
        addEventListener: noopthisfn,
        enableSyncLoading: noopfn,
        setRefreshUnfilledSlots: noopfn
      };
      const contentService = {
        addEventListener: noopthisfn,
        setContent: noopfn
      };
      const PassbackSlot = function() {
      };
      let p = PassbackSlot.prototype;
      p.display = noopfn;
      p.get = noopnullfn;
      p.set = noopthisfn;
      p.setClickUrl = noopthisfn;
      p.setTagForChildDirectedTreatment = noopthisfn;
      p.setTargeting = noopthisfn;
      p.updateTargetingFromMap = noopthisfn;
      const pubAdsService = {
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
      const SizeMappingBuilder = function() {
      };
      p = SizeMappingBuilder.prototype;
      p.addSize = noopthisfn;
      p.build = noopnullfn;
      const Slot = function() {
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
      p.getResponseInformation = noopnullfn;
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
      const gpt = window.googletag || {};
      const cmd = gpt.cmd || [];
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

  // https://github.com/gorhill/uBlock/blob/e86a4cee8787400d8ad445dd4a6e4515405f25d1/src/web_accessible_resources/google-analytics_analytics.js + GTM workaround
  /* eslint-disable no-empty */
  '/analytics.js': '(' +
    function() {
      'use strict';
      // https://developers.google.com/analytics/devguides/collection/analyticsjs/
      const noopfn = function() {
      };
      //
      const Tracker = function() {
      };
      const p = Tracker.prototype;
      p.get = noopfn;
      p.set = noopfn;
      p.send = noopfn;
      //
      const w = window;
      const gaName = w.GoogleAnalyticsObject || 'ga';
      const gaQueue = w[gaName];
      // https://github.com/uBlockOrigin/uAssets/pull/4115
      const ga = function() {
        const len = arguments.length;
        if ( len === 0 ) { return; }
        const args = Array.from(arguments);
        let fn;
        let a = args[len-1];
        if ( a instanceof Object && a.hitCallback instanceof Function ) {
          fn = a.hitCallback;
        } else if ( a instanceof Function ) {
          fn = ( ) => { a(ga.create()); };
        } else {
          const pos = args.indexOf('hitCallback');
          if ( pos !== -1 && args[pos+1] instanceof Function ) {
            fn = args[pos+1];
          }
        }
        if ( fn instanceof Function === false ) { return; }
        try {
          fn();
        } catch (ex) {
        }
      };
      ga.create = function() {
        return new Tracker();
      };
      ga.getByName = function() {
        return new Tracker();
      };
      ga.getAll = function() {
        return [];
      };
      ga.remove = noopfn;
      // https://github.com/uBlockOrigin/uAssets/issues/2107
      ga.loaded = true;
      w[gaName] = ga;
      // https://github.com/gorhill/uBlock/issues/3075
      const dl = w.dataLayer;
      if ( dl instanceof Object ) {
        if ( dl.hide instanceof Object && typeof dl.hide.end === 'function' ) {
          dl.hide.end();
        }
        /*
        if ( typeof dl.push === 'function' ) {
          const doCallback = function(item) {
            if ( item instanceof Object === false ) { return; }
            if ( typeof item.eventCallback !== 'function' ) { return; }
            setTimeout(item.eventCallback, 1);
          };
          if ( Array.isArray(dl) ) {
            dl.push = item => doCallback(item);
            const q = dl.slice();
            for ( const item of q ) {
              doCallback(item);
            }
          }
        }
        */
      }
      // empty ga queue
      if ( gaQueue instanceof Function && Array.isArray(gaQueue.q) ) {
        const q = gaQueue.q.slice();
        gaQueue.q.length = 0;
        for ( const entry of q ) {
          ga(...entry);
        }
      }
    } + ')();',
  /* eslint-enable no-empty */

  // https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/outbrain-widget.js + modified to unbreak vice.com
  // related uBO issues:
  // https://github.com/uBlockOrigin/uAssets/issues/7140
  // https://github.com/uBlockOrigin/uAssets/issues/8078
  '/outbrain.js': '(' +
    function() {
      'use strict';
      const noopfn = function() {
      };
      const obr = {};
      const methods = [
        'callClick', 'callLoadMore', 'callRecs', 'callUserZapping',
        'callWhatIs', 'cancelRecommendation', 'cancelRecs', 'closeCard',
        'closeModal', 'closeTbx', 'errorInjectionHandler', 'getCountOfRecs',
        'getStat', 'imageError', 'manualVideoClicked', 'onOdbReturn',
        'onVideoClick', 'pagerLoad', 'recClicked', 'refreshSpecificWidget',
        'refreshWidget', 'reloadWidget', 'renderSpaWidgets', 'researchWidget',
        'returnedError', 'returnedHtmlData', 'returnedIrdData', 'returnedJsonData',
        'scrollLoad', 'showDescription', 'showRecInIframe', 'userZappingMessage',
        'zappingFormAction'
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
surrogates['/tag/js/gpt.js'] = surrogates['/gpt.js'];

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
  MATCH_ANY,
  MATCH_SUFFIX,
  hostnames,
  surrogates,
};

return exports;
})();
