/* globals findInAllFrames:false */
let wrapped_link = "a[onmousedown^='return rwt(this,'], a[ping]";

// Remove excessive attributes and event listeners from link a
function cleanLink(a) {
  // remove all attributes from a link except for href
  for (let i = a.attributes.length - 1; i >= 0; --i) {
    const attr = a.attributes[i];
    if (attr.name !== 'href') {
      a.removeAttribute(attr.name);
    }
  }
  a.rel = "noreferrer noopener";

  // block event listeners on the link
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
}

// since the page is rendered all at once, no need to set up a
// mutationObserver or setInterval
findInAllFrames(wrapped_link).forEach((link) => {
  cleanLink(link);
});
