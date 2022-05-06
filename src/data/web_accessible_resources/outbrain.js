// https://github.com/gorhill/uBlock/blob/dcc72ba51c30abd4a1216049cc34f6c429ab2090/src/web_accessible_resources/outbrain-widget.js + modified to unbreak vice.com
(function() {
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
})();
