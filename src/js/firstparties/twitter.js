let query_param = 'data-expanded-url';
let found_tcos_query = "";
let fixes = {};
let tcos_with_target_query = "a[" + query_param + "][href^='https://t.co/'], a[" + query_param + "][href^='http://t.co/']";

function maybeAddNoreferrer(element) {
  let rel = element.rel ? element.rel : "";
  if (!rel.includes("noreferrer")) {rel += " noreferrer";}
  element.rel = rel;
}

function unwrapTco(tco, target) {
  if (!target) {
    return;
  }
  tco.href = target;
  tco.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  maybeAddNoreferrer(tco);
}

function checkLink(linkElement) {
  let attr = linkElement.getAttribute(query_param);
  if (attr && (attr.startsWith("https://") || attr.startsWith("http://"))) {
    let toBeReplaced = linkElement.href;
    fixes[toBeReplaced] = attr;
    if (found_tcos_query) {
      found_tcos_query += ", ";
    }
    unwrapTco(linkElement, attr);
    found_tcos_query += "a[href='" + toBeReplaced + "']";
  }
}

function unwrapTwitterURLs() {
  function removeInDoc(doc) {
    let yes_target = doc.querySelectorAll(tcos_with_target_query);
    for (let i = 0; i < yes_target.length; i++) {
      checkLink(yes_target[i]);
    }
    if (found_tcos_query) {
      let no_target = doc.querySelectorAll(found_tcos_query);
      for (let i = 0; i < no_target.length; i++) {
        unwrapTco(no_target[i], fixes[no_target[i].href]);
      }
    }
  }

  removeInDoc(document);
  let iframes = document.getElementsByTagName('iframe');
  for (let i = 0; i < iframes.length; i++) {
    try {
      removeInDoc(iframes[i].contentDocument);
    } catch(e) {
      console.log(e);
    }
  }
}

unwrapTwitterURLs();
setInterval(unwrapTwitterURLs, 1500);
