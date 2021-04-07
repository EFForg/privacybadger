window.isURL = function (url) {
  // ensure the URL starts with HTTP or HTTPS; otherwise we might be vulnerable
  // to XSS attacks
  return (url && (url.startsWith("https://") || url.startsWith("http://")));
};

/**
 * Search a window and all IFrames within it for a query selector, then return a
 * list of all the elements in any frame that match.
 */
window.findInAllFrames = function (query) {
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
};

/**
 * Listen for mutations on a page. If any nodes that match `selector` are added
 * to the page, execute the function `callback` on them.
 * Used by first-party scripts to listen for new links being added to the page
 * and strip them of tracking code immediately.
 */
window.observeMutations = function (selector, callback) {
  // Check all new nodes added by a mutation for tracking links and unwrap them
  function onMutation(mutation) {
    if (mutation.type == "attributes" && mutation.target) {
      callback(mutation.target);
      return;
    }

    for (let node of mutation.addedNodes) {
      // Only act on element nodes, otherwise querySelectorAll won't work
      if (node.nodeType != Node.ELEMENT_NODE) {
        continue;
      }

      // check all child nodes against the selector first
      node.querySelectorAll(selector).forEach((element) => {
        callback(element);
      });

      // then check the node itself
      if (node.matches(selector)) {
        callback(node);
      }
    }
  }

  // Set up a mutation observer with the constructed callback
  new MutationObserver(function (mutations) {
    mutations.forEach(onMutation);
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
    characterData: false,
  });
};
