// Adapted from https://github.com/mgziminsky/FacebookTrackingRemoval
(function() {
  let fb_shim_link = "a[onclick^='LinkshimAsyncLink.referrer_log']";
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
  function cleanLink(a, href) {
    cleanAttrs(a);
    a.href = href;
    a.target = "_blank";
    a.addEventListener("rlick", function (e) { e.stopPropagation(); }, true);
    a.addEventListener("mousedown", function (e) { e.stopPropagation(); }, true);
  }

  function unwrapRedirects() {
    console.log("Executing redirect unwrapping..."); 

    // unwrap wrapped links
    findInAllFrames(fb_wrapped_link).forEach((link) => {
      const newHref = new URL(link.href).searchParams.get('u');
      cleanLink(link, newHref);
    });

    // clean shim links
    findInAllFrames(fb_shim_link).forEach((link) => {
      console.log(link);
      // extract the real link from the shim link's onmouseover attribute
      let s = link.getAttribute("onmouseover"),
        extHref = s.substring(s.indexOf('"') + 1,
          s.lastIndexOf('"')).replace(/\\(.)/g, '$1');
      console.log(extHref);
      // replace the shim link with the real one
      cleanLink(link, extHref);
      console.log("Unwrapped shim link to " + extHref); 
    });
  }

  unwrapRedirects();
  setInterval(unwrapRedirects, 2000);
}());
