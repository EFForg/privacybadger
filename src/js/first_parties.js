/*

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

function insertScript(text) {
  var parent = document.documentElement,
    script = document.createElement('script');

  script.textContent = text;
  //script.async = false;

  parent.insertBefore(script, parent.firstChild);
  //parent.removeChild(script);
}


var code = '(' + function() {
  var console = {}
  window.console = console;
  window.console.log = function () {};
  function setConsole() {
    iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    if (!document.body) {
      return
    }

    document.body.appendChild(iframe);
    console = iframe.contentWindow.console;
    window.console = console;
    console.log("got console")
  }
  setConsole();

  var elems = [];
  console.log(elems);
  function unwrap(elem) { 
    var url = elem.href;
    if (url && url.toLowerCase().startsWith("https://t.co/")) {
      var deu = elem.getAttribute("data-expanded-url");
      if (deu && deu.startsWith("https://")) {
        elems.push(elem);
        elem.href = deu;
      }
    }
  }

  function unwrapTwitterURLs() {
    var aElems = document.getElementsByTagName("a");
    var n = aElems.length;
    console.log(n);
    for (var i = 0; i < n; i++) {
      var elem = aElems[i];

      unwrap(elem);
    }
  }

  setTimeout(() => {unwrapTwitterURLs()}, 1000);
} + ')();';

insertScript(code);
