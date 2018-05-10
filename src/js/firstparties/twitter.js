let query_params = [
  'data-expanded-url',
  'title'
];

let tcos_with_destination;
for (const queryParam of query_params) {
  tcos_with_destination += "a[" + queryParam + "][href^='https://t.co/'], a[" + queryParam + "][href^='http://t.co/'],";
}
tcos_with_destination = tcos_with_destination.slice(0, -1); // remove trailing comma

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
    let attr;

    // find real URL
    for (const queryParam of query_params) {
      attr = link.getAttribute(queryParam);

      // if value is found, stop further search
      if (attr) {
        break;
      }
    }

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
