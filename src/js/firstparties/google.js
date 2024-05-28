/* globals findInAllFrames:false, observeMutations:false */

let link_selector = [
  "a[href^='www.google.com/url?']",
  "a[href^='https://www.google.com/url?']",
  "a[href^='/url?q=']",
  `a[href^='${document.location.hostname}/url?']`,
].join(', ');

function cleanLink(a, norecurse) {
  if (!a.href.startsWith("https://www.google.com/url?") &&
    !a.href.startsWith(document.location.origin + "/url?")) {
    return;
  }

  let searchParams = (new URL(a.href)).searchParams,
    href = searchParams.get('url') || searchParams.get('q');

  if (!href || !window.isURL(href)) {
    return;
  }

  a.href = href;
  a.rel = "noreferrer noopener";

  // links could be double wrapped (`/mobilebasic` Google doc)
  if (!norecurse) {
    cleanLink(a, true);
  }
}

// TODO switch to registerContentScripts to fix race condition
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
