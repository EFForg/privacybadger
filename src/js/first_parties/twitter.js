/* globals config */

function maybeAddNoreferrer(element) {
  let rel = element.rel ? element.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  element.rel = rel;
}

function unwrapTco(tco, attr) {
  tco.href = attr;
  tco.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  maybeAddNoreferrer(tco);
}

function unwrapTwitterURLs() {
  let query = "a[" + config.queryParam + "][href^='https://t.co/'], a[" + config.queryParam + "][href^='http://t.co/']";
  // get links with t.co url's and destination url
  let aElems = document.querySelectorAll(query);
  for (let element of aElems) {
    let attr = element.getAttribute(config.queryParam);
    if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
      // replace all the t.co url's tha correspond to this destination
      let matchingTcos = document.querySelectorAll("a[href='" + element.href + "']");
      for (let tco of matchingTcos) {
        unwrapTco(tco, attr);
      }
    }
  }
  setTimeout(() => {unwrapTwitterURLs();}, 2000);
}

if (typeof window.wasrun === "undefined" || !window.wasrun) {
  window.wasrun = true;
  unwrapTwitterURLs();
}
