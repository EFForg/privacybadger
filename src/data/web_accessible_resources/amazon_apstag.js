// https://github.com/gorhill/uBlock/blob/395a4e36a939907982d3768c2d9eabb8aca8cbd1/src/web_accessible_resources/amazon_apstag.js
(function() {
    'use strict';
    const w = window;
    const noopfn = function() {
        ; // jshint ignore:line
    }.bind();
    const apstag = {
        fetchBids: function(a, b) {
            if ( typeof b === 'function' ) {
                b([]);
            }
        },
        init: noopfn,
        setDisplayBids: noopfn,
        targetingKeys: noopfn,
    };
    w.apstag = apstag;
})();
