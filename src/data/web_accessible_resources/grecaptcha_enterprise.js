(function () {

    let script_src = document.currentScript.src;

    window.grecaptcha = {};

    window.grecaptcha.enterprise = {
        ready: function (cb) {
            cb();
        },
        render: function (container) {
            if (Object.prototype.toString.call(container) != "[object String]") {
                if (!container.id) {
                    container.id = "grecaptcha-" + Math.random().toString().replace(".", "");
                }
                container = container.id;
            }
            document.dispatchEvent(new CustomEvent("pbSurrogateMessage", {
                detail: {
                    type: "widgetFromSurrogate",
                    name: "Google reCAPTCHA",
                    widgetData: {
                        domId: container,
                        scriptUrl: script_src
                    }
                }
            }));
        },
        execute: function () {}
    };

    let onload = (new URL(script_src)).searchParams.get('onload');
    if (onload && onload in window) {
        window[onload]();
    }

}());
