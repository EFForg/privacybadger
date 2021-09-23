(function () {
    var noopfn = function() {
        ;
    };
    function YqClass() {
        this.observe = noopfn;
        this.observeMin = noopfn;
        this.scroll_event = noopfn;
        this.onready = noopfn;
        this.yq_panel_click = noopfn;
        this.titleTrim = noopfn;
    }
    window.Yq || (window.Yq = new YqClass); // eslint-disable-line no-unused-expressions
}());
