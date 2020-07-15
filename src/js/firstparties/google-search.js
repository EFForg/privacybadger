/* globals findInAllFrames:false */
// In Firefox, outbound google links have the `rwt(...)` mousedown trigger.
// In Chrome, they just have a `ping` attribute.
let trap_link = "a[onmousedown^='return rwt(this,'], a[ping]";

// Remove excessive attributes and event listeners from link a
function cleanLink(a) {
  // remove all attributes except for href,
  // target (to support "Open each selected result in a new browser window"),
  // class, style and ARIA attributes
  for (let i = a.attributes.length - 1; i >= 0; --i) {
    const attr = a.attributes[i];
    if (attr.name !== 'href' && attr.name !== 'target' &&
        attr.name !== 'class' && attr.name !== 'style' &&
        !attr.name.startsWith('aria-')) {
      a.removeAttribute(attr.name);
    }
  }
  a.rel = "noreferrer noopener";

  // hacky way to see if LinkBlanker extension is installed, and if so, let that take priority in bubbling process
  let linkBlankerUrl = 'chrome-extension://lkafdfakakndhpcpccjnclopfncckhfn/img/icon-enabled.svg';

  // must use old school action here bc native fetch requires the http or https prefix
  let xmlHttp = new XMLHttpRequest();
  xmlHttp.open("GET", linkBlankerUrl, false);
  xmlHttp.send(null);
  if (!xmlHttp.status || xmlHttp.status !== 200) {
    // block event listeners on the link
    a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
    a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
  }
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  type: "checkEnabled"
}, function (enabled) {
  if (!enabled) {
    return;
  }

  // since the page is rendered all at once, no need to set up a
  // mutationObserver or setInterval
  findInAllFrames(trap_link).forEach((link) => {
    cleanLink(link);
  });
});
