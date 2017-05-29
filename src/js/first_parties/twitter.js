/* globals config */

function maybeAddNoreferrer(element) {
  let rel = element.rel ? element.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  element.rel = rel;
}

function unwrapTwitterURLs() {
  let query = "a[" + config.queryParam + "][href^='https://t.co/'], a[" + config.queryParam + "][href^='http://t.co/']";
  // get links with t.co url's and destination url
  let aElems = document.querySelectorAll(query);
  let n = aElems.length;
  for (let i = 0; i < n; i++) {
    let element = aElems[i];
    let attr = element.getAttribute(config.queryParam);
    if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
      // replace all the t.co url's tha correspond to this destination
      let matchingTcos = document.querySelectorAll("a[href='" + element.href + "']");
      let nMatches = matchingTcos.length;
      for (let j = 0; j < nMatches; j++) {
        let tco = matchingTcos[j];
        tco.href = attr;
        tco.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        maybeAddNoreferrer(tco);
      }
    }
  }
  setTimeout(() => {unwrapTwitterURLs();}, 2000);
}

if (typeof wasrun === "undefined" || !wasrun) {  // eslint-disable-line no-undef
  window.wasrun = true;
  unwrapTwitterURLs();
}
