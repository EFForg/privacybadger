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
  let aElems = document.querySelectorAll(query);
  for (let element of aElems) {
    let attr = element.getAttribute(config.queryParam);
    if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
      let toBeReplaced = element.href;
      fixes[toBeReplaced] = attr;
      if (badURLQuery) {
        badURLQuery += ", ";
      }
      badURLQuery += "a[href='" + toBeReplaced + "']";
      unwrapTco(element, attr);
    }
  }
  setTimeout(unwrapTwitterURLs, 2000);
}

function catchReappearingURLs() {
  function innerCatcher(bads) {
    for (let bad of bads) {
      let fix = fixes[bad.href];
      if (fix) {
        unwrapTco(bad, fix);
      }
    }
  }

  if (badURLQuery) {
    innerCatcher(document.querySelectorAll(badURLQuery));

    let iframes = document.querySelectorAll("iframe");
    for (let iframe of iframes) {
      try {
        innerCatcher(iframe.contentDocument.querySelectorAll(badURLQuery));
      } catch(e) {
        continue;
      }
    }
  }
  setTimeout(catchReappearingURLs, 5000);
}

if (typeof window.wasrun === "undefined" || !window.wasrun) {
  window.wasrun = true;
  var badURLQuery = "";
  var fixes = {};

  unwrapTwitterURLs();
  catchReappearingURLs();
}
