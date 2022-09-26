(function () {
    let origOnYouTubeIframeAPIReady,
        videoIds = [],
        targets = new Map(),
        configs = new Map(),
        surrogatePlayers = new Map();

    class Player {
        constructor(container, conf) {
            if (!conf.videoId) {
                return;
            }

            let id,
                target;

            if (Object.prototype.toString.call(container) == "[object String]") {
                id = container;
                target = document.getElementById(container);
            } else {
                if (container.id) {
                    id = container.id;
                } else {
                    id = "youtube-" + Math.random().toString().replace(".", "");
                    container.id = id;
                }
                target = container;
            }

            // save references for later
            videoIds.push(conf.videoId);
            targets.set(conf.videoId, target);
            configs.set(target, conf);
            surrogatePlayers.set(target, this);

            let detail = {
                type: "widgetFromSurrogate",
                name: "YouTube",
                widgetData: {
                    domId: id,
                    videoId: conf.videoId
                }
            };

            document.dispatchEvent(new CustomEvent("pbSurrogateMessage", { detail }));
        }
    }

    // https://developers.google.com/youtube/iframe_api_reference
    window.YT = {
        loaded: 1,
        Player,
        PlayerState: {
            UNSTARTED: -1,
            ENDED: 0,
            PLAYING: 1,
            PAUSED: 2,
            BUFFERING: 3,
            CUED: 5
        }
    };

    setTimeout(function () {
        if (typeof window.onYouTubeIframeAPIReady == "function") {
            origOnYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady;

            // this will have the page use our Player constructor,
            // which will message PB to replace the appropriate page element with a placeholder
            window.onYouTubeIframeAPIReady();
        }

        // if user clicks Allow in our placeholder, we will load the YT script,
        // which will then call this function
        window.onYouTubeIframeAPIReady = function () {
            if (origOnYouTubeIframeAPIReady) {
                // restore the original callback, just in case
                window.onYouTubeIframeAPIReady = origOnYouTubeIframeAPIReady;
            }

            for (let id of videoIds) {
                let target = targets.get(id),
                    config = configs.get(target),
                    surrogatePlayer = surrogatePlayers.get(target);

                if (!target || !config || !surrogatePlayer) {
                    continue;
                }

                // initialize the real Player object with previously
                // saved parameters; this will create the video element
                let player = new window.YT.Player(target, config);

                // as the page may have a reference to an instance of our surrogate Player,
                // make that instance behave as much as possible as the real thing
                Object.setPrototypeOf(surrogatePlayer, player);

                // clean up
                targets.delete(id);
                configs.delete(target);
                surrogatePlayers.delete(target);
            }
        };
    }, 0);
}());
