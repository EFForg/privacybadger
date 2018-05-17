(function() {
let g_wrapped_link = "a[onmousedown^='return rwt(this,']";

// Remove excessive attributes and event listeners from link a
function cleanLink(a) {
  // remove all attributes from a link except for href
  for (let i = elem.attributes.length - 1; i >= 0; --i) {
    const attr = elem.attributes[i];
    if (attr.name !== 'href') {
      elem.removeAttribute(attr.name);
    }
  }
  a.rel = "noreferrer";
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
}

// unwrap wrapped links in the original page
findInAllFrames(g_wrapped_link).forEach((link) => {
  cleanLink(link);
});
}());
