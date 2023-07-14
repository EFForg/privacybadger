/* globals findInAllFrames:false, observeMutations:false */

let link_selector;

// Google Docs
if (document.domain == "docs.google.com") {
  link_selector = "a[href^='www.google.com/url?']";

// Gmail
} else if (document.domain == "mail.google.com") {
  link_selector = "a[href^='https://www.google.com/url?']";

// Outbound Google search result links are different across browsers.
//
// Ignore internal links in Chrome and desktop Firefox
// to avoid unwrapping (and breaking the dropdown on) the settings link
} else {
  link_selector = [
    // Firefox
    "a[onmousedown^='return rwt(this,']:not([href^='/'])",
    // Chrome
    "a[ping]:not([href^='/'])",
    // Firefox Android
    "a[href^='/url?q=']",
    // alternate Firefox selector
    "a[data-jsarwt='1']",
    // image search results (all browsers)
    `a[href^='${document.domain}/url?']`,
  ].join(', ');
}

// Remove excessive attributes and event listeners from link elements
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

  // need to fix the href in Google Docs, Gmail, Google image search results,
  // or Google text search results with Firefox for Android
  if (a.href.startsWith("https://www.google.com/url?") || a.href.startsWith(document.location.origin + "/url?")) {
    let searchParams = (new URL(a.href)).searchParams;
    let href = searchParams.get('url') || searchParams.get('q');
    if (href && window.isURL(href)) {
      a.href = href;
    }
  }
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  type: "checkEnabled"
}, function (enabled) {
  if (!enabled) {
    return;
  }

  // clean already present links
  findInAllFrames(link_selector).forEach((link) => {
    cleanLink(link);
  });

  // clean dynamically added links
  observeMutations(link_selector, cleanLink);
});
