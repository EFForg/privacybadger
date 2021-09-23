// https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/google-analytics_ga.js
(function() {
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
})();
