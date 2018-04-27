// Adapted from https://github.com/mgziminsky/FacebookTrackingRemoval
(function() {
let fb_wrapped_link = "a[href*='facebook.com/l.php?'";

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
  cleanAttrs(a);
  a.href = href;
  a.target = "_blank";
  a.addEventListener("click", function (e) { e.stopPropagation(); }, true);
  a.addEventListener("mousedown", function (e) { e.stopPropagation(); }, true);
  a.addEventListener("mouseup", function (e) { e.stopPropagation(); }, true);
  a.addEventListener("mouseover", function (e) { e.stopPropagation(); }, true);
  a.addEventListener("mousewheel", function (e) { e.stopPropagation(); }, true);
}

// unwrap wrapped links in the original page
findInAllFrames(fb_wrapped_link).forEach((link) => {
  cleanLink(link);
});

// Execute redirect unwrapping each time new content is added to the page
new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.addedNodes.length) {
      for (let node of mutation.addedNodes) {
        node.querySelectorAll(fb_wrapped_link).forEach((link) => {
          cleanLink(link);
        });
      }
    }
  });
}).observe(document.body, {childList: true, subtree: true, attributes: false, characterData: false});
}());
