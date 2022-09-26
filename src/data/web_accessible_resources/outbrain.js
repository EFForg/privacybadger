// https://github.com/gorhill/uBlock/blob/a78bb0f8eb4a9c419bcafedba5a4e843232a16be/src/web_accessible_resources/outbrain-widget.js
(function() {
    'use strict';
    const noopfn = function() {
    };
    const obr = {};
    const methods = [
        'callClick',
        'callLoadMore',
        'callRecs',
        'callUserZapping',
        'callWhatIs',
        'cancelRecommendation',
        'cancelRecs',
        'closeCard',
        'closeModal',
        'closeTbx',
        'errorInjectionHandler',
        'getCountOfRecs',
        'getStat',
        'imageError',
        'manualVideoClicked',
        'onOdbReturn',
        'onVideoClick',
        'pagerLoad',
        'recClicked',
        'refreshSpecificWidget',
        'renderSpaWidgets',
        'refreshWidget',
        'reloadWidget',
        'researchWidget',
        'returnedError',
        'returnedHtmlData',
        'returnedIrdData',
        'returnedJsonData',
        'scrollLoad',
        'showDescription',
        'showRecInIframe',
        'userZappingMessage',
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
