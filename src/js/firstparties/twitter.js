let query_param = 'data-expanded-url';
let tcos_with_destination = getTCoSelectorWithDestination(query_param);
let query_param_profile = "title";
let profile_links_tcos = ".ProfileHeaderCard " + getTCoSelectorWithDestination(query_param_profile);
let fixes = {};

function getTCoSelectorWithDestination(attribute) {
  return "a[" + attribute + "][href^='https://t.co/'], a[" + attribute + "][href^='http://t.co/']";
}

function maybeAddNoreferrer(link) {
  let rel = link.rel ? link.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  link.rel = rel;
}

function getLinkAttribute(node, attribute) {
  let attr = node.getAttribute(attribute);
  if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
    return attr;
  }

  return null;
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

function unwrapTwitterURLsInTimeline() {
  // first iteration is needed to collect all links
  findInAllFrames(tcos_with_destination).forEach((link) => {
    let attr = getLinkAttribute(link, query_param);
    if (attr !== null) {
      fixes[link.href] = attr;
      // once we are here, we can also unwrap it directly, instead of iterating again later
      unwrapTco(link, attr);
    }
  });

  // iterate another time to actually replace the link (of Twitter cards, e.g.)
  findInAllFrames("a[href^='https://t.co/'], a[href^='http://t.co/'").forEach((link) => {
    if (fixes.hasOwnProperty(link.href)) {
      unwrapTco(link, fixes[link.href]);
    }
  });
}

function unwrapSpecialTwitterURLs() {
  // unwrap profile links
  document.querySelectorAll(profile_links_tcos).forEach((link) => {
    let attr = getLinkAttribute(link, query_param_profile);
    if (attr !== null) {
      unwrapTco(link, attr);
    }
  });
}

unwrapSpecialTwitterURLs();
unwrapTwitterURLsInTimeline();
setInterval(unwrapTwitterURLsInTimeline, 2000);
