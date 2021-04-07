let g_wrapped_link = "a[href^='https://www.google.com/url?']";

// Unwrap a Hangouts tracking link
function unwrapLink(a) {
  let href = new URL(a.href).searchParams.get('q');
  if (!window.isURL(href)) {
    return;
  }

  // remove all attributes except for target, class, style and aria-*
  // attributes. This should prevent the script from breaking styles and
  // features for people with disabilities.
  for (let i = a.attributes.length - 1; i >= 0; --i) {
    const attr = a.attributes[i];
    if (attr.name !== 'target' && attr.name !== 'class' &&
        attr.name !== 'style' && !attr.name.startsWith('aria-')) {
      a.removeAttribute(attr.name);
    }
  }

  a.rel = "noreferrer";
  a.href = href;
}

// Scan the page for all wrapped links
function unwrapAll() {
  document.querySelectorAll(g_wrapped_link).forEach((a) => {
    unwrapLink(a);
  });
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  type: "checkEnabled"
}, function (enabled) {
  if (!enabled) {
    return;
  }
  unwrapAll();
  setInterval(unwrapAll, 2000);
});
