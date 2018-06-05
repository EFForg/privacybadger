/* globals URL_REGEX:false */
let hangouts_wrapped_link = "a[href^='https://www.google.com/url?']";

// Unwrap a Hangouts tracking link 
function unwrapLink(a) {
  let href = new URL(a.href).searchParams.get('q');
  if (!href || !href.match(URL_REGEX)) {
    return;
  }

  // remove all attributes from a link except for target
  for (let i = a.attributes.length - 1; i >= 0; --i) {
    const attr = a.attributes[i];
    if (attr.name !== "target") {
      a.removeAttribute(attr.name);
    }
  }

  a.rel = "noreferrer";
  a.href = href;
}

// Scan the page for all wrapped links
function unwrapAll() {
  document.querySelectorAll(hangouts_wrapped_link).forEach((a) => {
    unwrapLink(a);
  });
}

setInterval(unwrapAll, 2000);
