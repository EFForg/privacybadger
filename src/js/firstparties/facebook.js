// Adapted from https://github.com/mgziminsky/FacebookTrackingRemoval
(function() {
let fb_wrapped_link = `a[href*='${document.domain}/l.php?'`;

// remove all attributes from a link except for class and ARIA attributes
function cleanAttrs(elem) {
  for (let i = elem.attributes.length - 1; i >= 0; --i) {
    const attr = elem.attributes[i];
    if (attr.name !== 'class' && !attr.name.startsWith('aria-')) {
      elem.removeAttribute(attr.name);
    }
  }
}

// Remove excessive attributes and event listeners from link a and replace
// its destination with href
function cleanLink(a) {
  let href = new URL(a.href).searchParams.get('u');

  // ensure the URL starts with HTTP or HTTPS
  if (!href || !(href.startsWith("https://") || href.startsWith("http://"))) {
    // If we can't extract a good URL, abort without breaking the links
    return;
  }

  cleanAttrs(a);
  a.href = href;
  a.rel = "noreferrer";
  a.target = "_blank";
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mouseup", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mouseover", function (e) { e.stopImmediatePropagation(); }, true);
}

// unwrap wrapped links in the original page
findInAllFrames(fb_wrapped_link).forEach((link) => {
  cleanLink(link);
});

// Execute redirect unwrapping each time new content is added to the page
observeMutations(fb_wrapped_link, cleanLink);
}());
