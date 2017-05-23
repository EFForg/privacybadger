/*
This unwraps t.co links on twitter.com. We check that the link's href points to
a t.co domain, then check it has the "data-expanded-url" attribute. Then we
replace the href value with the data-expanded-url value. Here is an example link
from https://twitter.com/EFF/status/864493178816090113 

  <a
      href="https://t.co/U4YMYoAUCK"
      rel="nofollow noopener"
      dir="ltr"
      data-expanded-url="https://www.supremecourt.gov/opinions/16pdf/16-341_8n59.pdf"
      class="twitter-timeline-link" target="_blank"
      title="https://www.supremecourt.gov/opinions/16pdf/16-341_8n59.pdf"
  >
      <span class="tco-ellipsis"></span>
      <span class="invisible">https://www.</span>
      <span class="js-display-url">supremecourt.gov/opinions/16pdf</span>
      <span class="invisible">/16-341_8n59.pdf</span>
      <span class="tco-ellipsis"><span class="invisible">&nbsp;</span>…</span>
    </a>
  
*/

function unwrapTwitterURLs() {
  // will this still select link with different capitalization like "HhtPs://t.Co"? 
  let aElems = document.querySelectorAll("a[data-expanded-url][href^='https://t.co/']");
  let n = aElems.length;
  for (let i = 0; i < n; i++) {
    let elem = aElems[i];
    let deu = elem.getAttribute("data-expanded-url");
    if (deu && (deu.startsWith("https://") || deu.startsWith("http://"))) {
      elem.href = deu;
    }
  }
}

setInterval(unwrapTwitterURLs, 5000);
