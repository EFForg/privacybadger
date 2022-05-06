(function () {
    if ("Rumble" in window && "_" in window.Rumble) {
        for (let args of window.Rumble._) {
            args = [].slice.apply(args);

            let cmd = args[0],
                conf = args[1],
                script_src = document.currentScript.src,
                idx = script_src.indexOf("/embedJS/"),
                pub_code;

            if (idx != -1) {
                script_src = script_src.slice(idx + "/embedJS/".length);
                idx = script_src.indexOf("/");
                if (idx != -1) {
                    script_src = script_src.slice(0, idx);
                    idx = script_src.indexOf(".");
                    if (idx != -1) {
                        pub_code = script_src.slice(0, idx);
                    }
                }
            }

            if (pub_code && cmd == "play" && "div" in conf && "video" in conf) {
                document.dispatchEvent(new CustomEvent("pbSurrogateMessage", {
                    detail: {
                        type: "widgetFromSurrogate",
                        name: "Rumble Video Player",
                        widgetData: {
                            pubCode: pub_code,
                            args
                        }
                    }
                }));
            }
        }
    }
}());
