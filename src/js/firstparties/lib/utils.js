// from https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
window.URL_REGEX = new RegExp(/[-a-zA-Z0-9@:%_+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_+.~#?&//=]*)?/gi);

window.findInAllFrames = function(query) {
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

window.observeMutations = function(selector, callback) {
  // Check all new nodes added by a mutation for tracking links and unwrap them
  function onMutation(mutation) {
    if (!mutation.addedNodes.length) {
      return;
    }
    for (let node of mutation.addedNodes) {
      if (node.nodeType != Node.ELEMENT_NODE) {
        continue;
      }
      node.querySelectorAll(selector).forEach((element) => {
        callback(element);
      });
      if (node.matches(selector)) {
        callback(node);
      }
    }
  }

  // Set up a mutation observer with the constructed callback
  new MutationObserver(function(mutations) {
    mutations.forEach(onMutation);
  }).observe(document, {childList: true, subtree: true, attributes: false, characterData: false});
};
