/* globals findInAllFrames:false, observeMutations:false */

let link_selector = [
  "a[href^='www.google.com/url?']",
  "a[href^='https://www.google.com/url?']",
  "a[href^='/url?q=']",
  `a[href^='${document.location.hostname}/url?']`,
].join(', ');

function cleanLink(a) {
  // need to fix the href in Google Docs, Gmail, Google image search results,
  // or Google text search results with Firefox for Android
  if (a.href.startsWith("https://www.google.com/url?") || a.href.startsWith(document.location.origin + "/url?")) {
    let searchParams = (new URL(a.href)).searchParams;
    let href = searchParams.get('url') || searchParams.get('q');
    if (href && window.isURL(href)) {
      a.href = href;
      a.rel = "noreferrer noopener";
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
