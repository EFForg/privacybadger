/* globals findInAllFrames:false, observeMutations:false */
// Adapted from https://github.com/mgziminsky/FacebookTrackingRemoval
// this should only run on facebook.com, messenger.com, and
// facebookcorewwwi.onion
let fb_wrapped_link = `a[href*='${document.domain.split(".").slice(-2).join(".")}/l.php?']:not([aria-label])`;

function stopPropagation(e) {
  e.stopImmediatePropagation();
}

// remove all attributes from a link
function cleanAttrs(elem) {
  for (let attr of elem.attributes) {
    // with some exceptions
    if (attr.name != 'href' && attr.name != 'class' && !attr.name.startsWith('aria-')) {
      elem.removeAttribute(attr.name);
    }
  }
}

/**
 * Cleans link elements:
 *
 *  - removes link redirection/"unwraps" the href
 *  - removes fbclid parameter
 *  - removes non-essential attributes
 *  - stops mouse events
 *
 * Could be called multiple times on the same element.
 *
 * @param {Element} el the link element
 */
function cleanLink(el) {
  let cleaned = false,
    url = new URL(el.href);

  // remove link redirection
  if (url.searchParams.has('u')) {
    let u_param = url.searchParams.get('u');
    if (window.isURL(u_param)) {
      // now remove fbclid
      let uParamUrl = new URL(u_param);
      uParamUrl.searchParams.delete('fbclid');
      el.href = uParamUrl.toString();
      cleaned = true;
    }

  // just remove fbclid
  } else if (url.searchParams.has('fbclid')) {
    url.searchParams.delete('fbclid');
    el.href = url.toString();
    cleaned = true;
  }

  if (!cleaned) {
    return;
  }

  cleanAttrs(el);

  el.rel = "noreferrer noopener";
  el.target = "_blank";

  el.addEventListener("click", stopPropagation, true);
  el.addEventListener("mousedown", stopPropagation, true);
  el.addEventListener("mouseup", stopPropagation, true);
  el.addEventListener("mouseover", stopPropagation, true);
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  type: "checkEnabled"
}, function (enabled) {
  if (!enabled) {
    return;
  }

  // unwrap wrapped links in the original page
  findInAllFrames(fb_wrapped_link).forEach((link) => {
    cleanLink(link);
  });

  // execute redirect unwrapping each time new content is added to the page
  observeMutations(fb_wrapped_link, cleanLink);
});
