/* globals config */

function maybeAddNoreferrer(element) {
  let rel = element.rel ? element.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  element.rel = rel;
}

function unwrapTwitterURLs() {
  let query = "a[" + config.queryParam + "][href^='https://t.co/']";
  let aElems = document.querySelectorAll(query);
  let n = aElems.length;
  for (let i = 0; i < n; i++) {
    let element = aElems[i];
    let attr = element.getAttribute(config.queryParam);
    if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
      element.href = attr;
      element.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      maybeAddNoreferrer(element);
    }
  }
  setTimeout(() => {unwrapTwitterURLs();}, 2000);
}

if (typeof wasrun === "undefined" || !wasrun) {
  var wasrun = true;
  unwrapTwitterURLs();
}
