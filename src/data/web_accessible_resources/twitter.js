(function () {
    function requestReplacement() {
        document.dispatchEvent(new CustomEvent("pbSurrogateMessage", {
            detail: {
                type: "widgetFromSurrogate",
                name: "X (Twitter)"
            }
        }));
    }

    let _e = [];
    if (window.twttr && window.twttr._e && Array.isArray(window.twttr._e)) {
        _e = window.twttr._e;
    }

    window.twttr = {};
    window.twttr.events = {
        bind: function () {}
    };
    window.twttr.widgets = {};

    window.twttr.ready = function (cb) {
        if (cb) {
            return cb(window.twttr);
        }
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve(window.twttr);
            }, 0);
        });
    };

    window.twttr.widgets.load = function () {
        requestReplacement();
    };

    window.twttr.widgets.createTweet = function (tweet_id, targetEl) { // TODO handle `options` (3rd param)
        return new Promise(function (resolve) {
            setTimeout(function () {
                let safe_tweet_id = tweet_id.replace(/[^0-9]/g, ''); // digits only
                targetEl.innerHTML = `<blockquote class="twitter-tweet"><a href="https://twitter.com/x/status/${safe_tweet_id}">Loading Tweet ID ${safe_tweet_id} ...</a></blockquote>`; // TODO i18n "loading" message
                requestReplacement();
                resolve(targetEl.children[0]);
            }, 0);
        });
    };
    // alias
    window.twttr.widgets.createTweetEmbed = window.twttr.widgets.createTweet;

    window.twttr.widgets.createTimeline = async function () {}; // returns a Promise

    // "an asynchronous function queue storing functions
    // to be executed in an array accessible at window.twttr._e"
    // https://developer.x.com/en/docs/x-for-websites/embedded-tweets/guides/cms-best-practices
    for (let fn of _e) {
        fn();
    }

    // to support simple blockquote/iframe embeds
    // that won't call any API methods here
    requestReplacement();
}());
