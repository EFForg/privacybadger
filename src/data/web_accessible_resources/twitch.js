(function () {
    function message(kind, id, conf) {
        let detail = {
            type: "widgetFromSurrogate",
            name: "Twitch " + kind,
            widgetData: {
                domId: id,
                videoId: conf.channel
            }
        };
        document.dispatchEvent(new CustomEvent("pbSurrogateMessage", { detail }));
    }

    // https://dev.twitch.tv/docs/embed/everything/
    class Embed {
        constructor(id, conf) {
            message("Embed", id, conf);
        }
    }

    class Player {
        constructor(id, conf) {
            message("Player", id, conf);
        }

        setVolume() {
        }
    }

    window.Twitch = {
        Embed,
        Player
    };
}());
