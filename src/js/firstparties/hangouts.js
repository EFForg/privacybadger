(function() {
let hangouts_wrapped_link = "a[href^='https://www.google.com/url?']";

// Remove excessive attributes and event listeners from link a
function cleanLink(a) {
  // remove all attributes from a link except for href
  for (let i = elem.attributes.length - 1; i >= 0; --i) {
    const attr = elem.attributes[i];
    if (attr.name !== 'href' && attr.name !== "target") {
      elem.removeAttribute(attr.name);
    }
  }
  a.rel = "noreferrer";
}

// Unwrap a Hangouts tracking link 
function unwrapLink(a) {
  let href = new URL(a.href).searchParams.get('q');
  if (!href || !href.match(URL_REGEX)) {
    return;
  }

  cleanLink(a);
  a.href = href;
}

// unwrap links in Hangouts as they are added to the page
observeMutations(hangouts_wrapped_link, unwrapLink);
}());
