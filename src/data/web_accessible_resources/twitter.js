(function () {
    function requestReplacement() {
        document.dispatchEvent(new CustomEvent("pbSurrogateMessage", {
            detail: {
                type: "widgetFromSurrogate",
                name: "X (Twitter)"
            }
        }));
    }

    window.twttr = {};
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
                targetEl.innerHTML = `<blockquote class="twitter-tweet"><a href="https://twitter.com/x/status/${tweet_id}">Loading Tweet ID ${tweet_id} ...</a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`; // TODO i18n "loading" message
                requestReplacement();
                resolve(targetEl.children[0]);
            }, 0);
        });
    };
    // alias
    window.twttr.widgets.createTweetEmbed = window.twttr.widgets.createTweet;

    window.twttr.widgets.load();
}());
