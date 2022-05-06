// https://github.com/gorhill/uBlock/blob/e86a4cee8787400d8ad445dd4a6e4515405f25d1/src/web_accessible_resources/google-analytics_analytics.js + GTM workaround (e1f32a3)
(function() {
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
})();
