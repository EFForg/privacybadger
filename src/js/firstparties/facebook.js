/* globals findInAllFrames:false, observeMutations:false */
// Adapted from https://github.com/mgziminsky/FacebookTrackingRemoval
let fb_wrapped_link = `a[href*='${document.domain}/l.php?']:not([aria-label='photo'])`;

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

  // If we can't extract a good URL, abort without breaking the links
  if (!window.isURL(href)) {
    return;
  }

  let href_url = new URL(href);
  href_url.searchParams.delete('fbclid');
  href = href_url.toString();

  cleanAttrs(a);
  a.href = href;
  a.rel = "noreferrer";
  a.target = "_blank";
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mouseup", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mouseover", function (e) { e.stopImmediatePropagation(); }, true);
}

//TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({checkEnabled: true},
  function (enabled) {
    if (!enabled) {
      return;
    }

    // unwrap wrapped links in the original page
    findInAllFrames(fb_wrapped_link).forEach((link) => {
      cleanLink(link);
    });

    // Execute redirect unwrapping each time new content is added to the page
    observeMutations(fb_wrapped_link, cleanLink);
  }
);
