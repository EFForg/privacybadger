let query_param = 'data-expanded-url';
let tcos_with_destination = "a[" + query_param + "][href^='https://t.co/'], a[" + query_param + "][href^='http://t.co/']";
let fixes = {};

function maybeAddNoreferrer(link) {
  let rel = link.rel ? link.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  link.rel = rel;
}

function unwrapTco(tco, destination) {
  if (!destination) {
    return;
  }
  tco.href = destination;
  tco.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  maybeAddNoreferrer(tco);
}

function findInAllFrames(query) {
  let out = [];
  document.querySelectorAll(query).forEach((node) => {
    out.push(node);
  });
  Array.from(document.getElementsByTagName('iframe')).forEach((iframe) => {
    try {
      iframe.contentDocument.querySelectorAll(query).forEach((node) => {
        out.push(node);
      });
    } catch (e) {
      // pass on cross origin iframe errors
    }
  });
  return out;
}

function unwrapTwitterURLs() {
  findInAllFrames(tcos_with_destination).forEach((link) => {
    let attr = link.getAttribute(query_param);
    if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
      fixes[link.href] = attr;
      unwrapTco(link, attr);
    }
  });
  findInAllFrames("a[href^='https://t.co/'], a[href^='http://t.co/'").forEach((link) => {
    if (fixes.hasOwnProperty(link.href)) {
      unwrapTco(link, fixes[link.href]);
    }
  });
}

unwrapTwitterURLs();
setInterval(unwrapTwitterURLs, 2000);
