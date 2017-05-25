const deu = "data-expanded-url",
  dfu = "data-full-url";
const twitterQuery = "a[" + deu + "][href^='https://t.co/']",
  tweetdeckQuery = "a[" + dfu + "][href^='https://t.co/']";

function maybeAddNoreferrer(el) {
  let rel = el.rel ? el.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  el.rel = rel;
}

function unwrapTwitterURLs() {
  let aElems = document.querySelectorAll(twitterQuery + ", " + tweetdeckQuery);
  let n = aElems.length;
  for (let i = 0; i < n; i++) {
    let elem = aElems[i];
    let attr = elem.getAttribute(deu);
    if (!attr) {attr = elem.getAttribute(dfu);}
    if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
      elem.href = attr;
      elem.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      maybeAddNoreferrer(elem);
    }
  }
  setTimeout(() => {unwrapTwitterURLs();}, 1500);
}
unwrapTwitterURLs();
