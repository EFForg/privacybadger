// only observed links with this format out in the wild
let tumblr_links = "a[href^='https://t.umblr.com/redirect?']"

// reassigns the href and scrubs link of all unnecessary attributes
function unwrapLink(a) {
  let href = new URL(a.href).searchParams.get('z');
  if (!window.isURL(href)) {
    return;
  }

  for (let attr of a.attributes) {
    if (!['target', 'class', 'style'].includes(attr.name)) {
      a.removeAttribute(attr.name)
    }
  }

  a.rel = "noreferrer";
  a.href = href;
}

// main handler to target each link on page and launder them through the unwrapLink func
function unwrapAll() {
  document.querySelectorAll(tumblr_links).forEach((a) => {
    unwrapLink(a);
  });
}

chrome.runtime.sendMessage({
  type: "checkEnabled"
}, function (enabled) {
  if (!enabled) {
    return;
  }
  unwrapAll();
  setInterval(unwrapAll, 2000);
});
