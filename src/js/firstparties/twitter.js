 /* todo:
  * * setup observers
  * the tests are 
 */

let queryParam = 'data-expanded-url';
let badURLQuery = "";
let fixes = {};
let query = "a[" + queryParam + "][href^='https://t.co/'], a[" + queryParam + "][href^='http://t.co/']";

function startObserver() {
  let observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.matches(query)) {
          let attr = node.getAttribute(queryParam);
          if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
            let toBeReplaced = node.href;
            fixes[toBeReplaced] = attr;
            if (badURLQuery) {
              badURLQuery += ", ";
            }
            console.log('unwrapped in observer');
            unwrapTco(node, attr);
            badURLQuery += "a[href='" + toBeReplaced + "']";
          }
        }
      });
    });
  });

  let timeline = document.getElementById('timeline');
  let config = {childList: true, subtree: true};
  observer.observe(timeline, config);
  return observer;
}

function maybeAddNoreferrer(element) {
  let rel = element.rel ? element.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  element.rel = rel;
}

function unwrapTco(tco, attr) {
  console.log('unwrapping ' + tco + attr);
  tco.href = attr;
  tco.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  maybeAddNoreferrer(tco);
}

function checkLink(linkElelement) {
  let attr = linkElelement.getAttribute(queryParam);
  if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
    let toBeReplaced = linkElelement.href;
    fixes[toBeReplaced] = attr;
    if (badURLQuery) {
      badURLQuery += ", ";
    }
    unwrapTco(linkElelement, attr);
    badURLQuery += "a[href='" + toBeReplaced + "']";
    console.log('unwrapped one');
  }
}

function unwrapTwitterURLs() {
  debugger;
  let aElems = document.querySelectorAll(query);
  for (let element of aElems) {
    console.log('found elem');
    checkLink(element);
  }
}
/* main */
startObserver();
unwrapTwitterURLs();

/* deprecate below */
function catchReappearingURLs() {
  function innerCatcher(bads) {
    for (let bad of bads) {
      let fix = fixes[bad.href];
      if (fix) {
        unwrapTco(bad, fix);
      }
    }
  }

  if (badURLQuery) {
    innerCatcher(document.querySelectorAll(badURLQuery));

    let iframes = document.querySelectorAll("iframe");
    for (let iframe of iframes) {
      try {
        innerCatcher(iframe.contentDocument.querySelectorAll(badURLQuery));
      } catch(e) {
        continue;
      }
    }
  }
  setTimeout(catchReappearingURLs, 5000);
}
