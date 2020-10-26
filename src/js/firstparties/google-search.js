/* globals findInAllFrames:false */

// bool for whether or not in firefox for android
let firefox_android = (navigator.userAgent.indexOf('Firefox') > -1 && navigator.userAgent.indexOf('Android') > -1);

// In Firefox, outbound google links have the `rwt(...)` mousedown trigger.
// In Chrome, they just have a `ping` attribute.
let trap_link = "a[onmousedown^='return rwt(this,'], a[ping]";

// Firefox Android has neither the mousedown trigger nor ping attribute
if (firefox_android) {
  trap_link = 'a';
}

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

  // block event listeners on the link
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);

  // reassign href when in firefox android
  if (firefox_android) {
    let href = new URL(a.href).searchParams.get('q');
    if (!window.isURL(href)) {
      return;
    }
    a.href = href;
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
