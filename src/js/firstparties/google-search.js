/* globals findInAllFrames:false */
// In Firefox, outbound google links have the `rwt(...)` mousedown trigger.
// In Chrome, they just have a `ping` attribute.
let trap_link = "a[onmousedown^='return rwt(this,'], a[ping]";

// Remove excessive attributes and event listeners from link a
function cleanLink(a) {
  // remove all attributes from a link except for href,
  // target (to support "Open each selected result in a new browser window"),
  // class and ARIA attributes
  for (let i = a.attributes.length - 1; i >= 0; --i) {
    const attr = a.attributes[i];
    if (attr.name !== 'href' && attr.name !== 'target' &&
      attr.name !== 'class' && !attr.name.startsWith('aria-')) {
      a.removeAttribute(attr.name);
    }
  }
  a.rel = "noreferrer noopener";

  // block event listeners on the link
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
}

//TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({checkEnabled: true},
  function (enabled) {
    if (!enabled) {
      return;
    }

    // since the page is rendered all at once, no need to set up a
    // mutationObserver or setInterval
    findInAllFrames(trap_link).forEach((link) => {
      cleanLink(link);
    });

  }
);
