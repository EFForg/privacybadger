const tcos_all = getTCoSelectorWithDestination();
const timeline_refresh_interval = 2000;

// twitter.com
const full_url_attribute = 'title';
const tcos_with_destination = getTCoSelectorWithDestination(full_url_attribute);

const fixes = {};

function getTCoSelectorWithDestination(attribute) {
  let aSelector = "a";
  if (attribute) {
    aSelector = "a[" + attribute + "]";
  }

  return aSelector + "[href^='https://t.co/'], " + aSelector + "[href^='http://t.co/']";
}

function maybeAddNoreferrer(link) {
  let rel = link.rel ? link.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  link.rel = rel;
}

function getLinkByAttribute(node, attribute) {
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
    const attr = getLinkByAttribute(link, full_url_attribute);
    if (attr !== null) {
      fixes[link.href] = attr;
      // once we are here, we can also unwrap it directly, instead of iterating again later
      unwrapTco(link, attr);
    }
  });

  // iterate another time to actually replace the link (of Twitter cards, e.g.)
  findInAllFrames(tcos_all).forEach((link) => {
    if (fixes.hasOwnProperty(link.href)) {
      unwrapTco(link, fixes[link.href]);
    }
  });
}

function unwrapSpecialTwitterPwaURLs() {
  try {
    // iterate users object (usually should only be one, with some random ID?)
    for (const entityKey of Object.keys(window.wrappedJSObject.__INITIAL_STATE__.entities.users.entities)) {
      const entityValue = window.wrappedJSObject.__INITIAL_STATE__.entities.users.entities[entityKey];
      // iterate url array (usually only one)
      for (const url of entityValue.entities.url.urls) {
        // save for later use (will be unwrapped later)
        fixes[url.url] = url.expanded_url;
      }
    }
  } catch (e) {
    // ignore errors and only log them when the JSON of Twitter should change
    console.error(e);
  }
}

unwrapTwitterURLsInTimeline();

// only works at initial load if you directly load a profile
unwrapSpecialTwitterPwaURLs();

setInterval(unwrapTwitterURLsInTimeline, timeline_refresh_interval);
