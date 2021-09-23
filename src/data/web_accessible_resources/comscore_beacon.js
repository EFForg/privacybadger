// https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/scorecardresearch_beacon.js
(function() {
    'use strict';
    window.COMSCORE = {
        purge: function() {
            window._comscore = [];
        },
        beacon: function() {
        }
    };
})();
