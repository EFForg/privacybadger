// https://github.com/gorhill/uBlock/blob/4b95420e5912cb2759da77dbb3d0d64095021c13/src/web_accessible_resources/amazon_apstag.js
(function() {
    'use strict';
    const w = window;
    const noopfn = function() {
        ; // jshint ignore:line
    }.bind();
    const apstag = {
        fetchBids: function(a, b) {
            if ( b instanceof Function ) {
                b([]);
            }
        },
        init: noopfn,
        setDisplayBids: noopfn,
        targetingKeys: noopfn,
    };
    w.apstag = apstag;
})();
