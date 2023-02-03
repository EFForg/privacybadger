// https://github.com/gorhill/uBlock/blob/d7e1da6274a38301b6db18579021f1394a32d831/src/web_accessible_resources/googletagmanager_gtm.js
(function() {
    'use strict';
    const noopfn = function() {
    };
    const w = window;
    w.ga = w.ga || noopfn;
    const dl = w.dataLayer;
    if ( dl instanceof Object === false ) { return; }
    if ( dl.hide instanceof Object && typeof dl.hide.end === 'function' ) {
        dl.hide.end();
    }
    if ( typeof dl.push === 'function' ) {
        dl.push = function(o) {
            if (
                o instanceof Object &&
                typeof o.eventCallback === 'function'
            ) {
                setTimeout(o.eventCallback, 1);
            }
        };
    }
})();
