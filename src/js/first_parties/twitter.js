function unwrapTwitterURLs() {
  let aElems = document.querySelectorAll("a[data-expanded-url][href^='https://t.co/']");
  let n = aElems.length;
  for (let i = 0; i < n; i++) {
    let elem = aElems[i];
    let deu = elem.getAttribute("data-expanded-url");
    if (deu && (deu.startsWith("https://") || deu.startsWith("http://"))) {
      elem.href = deu;
      elem.addEventListener("click", function (e) {
        e.stopPropagation(); // don't let the event click propogate to twitter
      });
    }
  }
}

setInterval(unwrapTwitterURLs, 5000);
