(function () {
    // https://dev.twitch.tv/docs/embed/everything/
    class Embed {
        constructor(id, conf) {
            let detail = {
                type: "widgetFromSurrogate",
                name: "Twitch Player",
                widgetData: {
                    domId: id,
                    videoId: conf.channel
                }
            };
            document.dispatchEvent(new CustomEvent("pbSurrogateMessage", { detail }));
        }
    }

    window.Twitch = {
        Embed
    };
}());
