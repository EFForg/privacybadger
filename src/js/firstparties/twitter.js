const tcos_all = getTCoSelectorWithDestination();
const timeline_refresh_interval = 2000;

// twitter.com
const full_url_attribute = 'data-expanded-url';
const tcos_with_destination = getTCoSelectorWithDestination(full_url_attribute);
const full_url_attribute_profile = "title";
const profile_links_tcos = ".ProfileHeaderCard " + getTCoSelectorWithDestination(full_url_attribute_profile);

// mobile.twitter.com
const link_reg_ex = /\(link: (https?:\/\/.+)\)/;

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

function unwrapTwitterPwaURLsInTimeline() {
  // unwrap profile links
  document.querySelectorAll(tcos_all).forEach((link) => {
    // use cached value if possible
    if (fixes.hasOwnProperty(link.href)) {
      unwrapTco(link, fixes[link.href]);
      return;
    }

    // find span element with link text in it
    const allSpans = link.getElementsByTagName("span");
    if (!allSpans.length) {
      return;
    }

    const linkElement = allSpans[0];
    const elements = link_reg_ex.exec(linkElement.textContent);
    if (elements === null) {
      return;
    }

    const url = elements[1];
    if (url) {
      fixes[link.href] = url;
      unwrapTco(link, url);
    }
  });
}

function unwrapSpecialTwitterURLs() {
  // unwrap profile links
  document.querySelectorAll(profile_links_tcos).forEach((link) => {
    const attr = getLinkByAttribute(link, full_url_attribute_profile);
    if (attr !== null) {
      unwrapTco(link, attr);
    }
  });
}

function unwrapSpecialTwitterPwaURLs() {
  // profile URL can be found in JSON of page
  if (!window.wrappedJSObject) {
    return;
  }

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

if (window.location.hostname == "mobile.twitter.com") {
  unwrapSpecialTwitterPwaURLs();
  unwrapTwitterPwaURLsInTimeline();

  setInterval(unwrapTwitterPwaURLsInTimeline, timeline_refresh_interval);
} else {
  unwrapTwitterURLsInTimeline();
  unwrapSpecialTwitterURLs();

  setInterval(unwrapTwitterURLsInTimeline, timeline_refresh_interval);
}
