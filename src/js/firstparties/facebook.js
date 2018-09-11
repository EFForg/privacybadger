// Adapted from https://github.com/mgziminsky/FacebookTrackingRemoval
(function() {
let fb_wrapped_link = `a[href*='${document.domain}/l.php?'`;

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

// remove all attributes from a link except for class and ARIA attributes
function cleanAttrs(elem) {
  for (let i = elem.attributes.length - 1; i >= 0; --i) {
    const attr = elem.attributes[i];
    if (attr.name !== 'class' && !attr.name.startsWith('aria-')) {
      elem.removeAttribute(attr.name);
    }
  }
}

// Remove excessive attributes and event listeners from link a and replace
// its destination with href
function cleanLink(a) {
  let href = new URL(a.href).searchParams.get('u');

  // ensure the URL starts with HTTP or HTTPS
  if (!href || !(href.startsWith("https://") || href.startsWith("http://"))) {
    // If we can't extract a good URL, abort without breaking the links
    return;
  }

  cleanAttrs(a);
  a.href = href;
  a.rel = "noreferrer";
  a.target = "_blank";
  a.addEventListener("click", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mouseup", function (e) { e.stopImmediatePropagation(); }, true);
  a.addEventListener("mouseover", function (e) { e.stopImmediatePropagation(); }, true);
}

// Check all new nodes added by a mutation for tracking links and unwrap them
function cleanMutation(mutation) {
  if (!mutation.addedNodes.length) {
    return;
  }
  for (let node of mutation.addedNodes) {
    // only element nodes have querySelectorAll
    if (node.nodeType != Node.ELEMENT_NODE) {
      continue;
    }
    node.querySelectorAll(fb_wrapped_link).forEach((link) => {
      cleanLink(link);
    });
    if (node.matches(fb_wrapped_link)) {
      cleanLink(node);
    }
  }
}

//TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({checkEnabled: true},
  function (enabled) {
    if (!enabled) {
      return;
    }
    // unwrap wrapped links in the original page
    findInAllFrames(fb_wrapped_link).forEach((link) => {
      cleanLink(link);
    });

    // Execute redirect unwrapping each time new content is added to the page
    new MutationObserver(function(mutations) {
      mutations.forEach(cleanMutation);
    }).observe(document.body, {childList: true, subtree: true, attributes: false, characterData: false});
  }
);
}());
