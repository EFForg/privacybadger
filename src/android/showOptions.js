document.querySelector("button").addEventListener("click", function() {
  window.open(chrome.runtime.getManifest().options_page);
})
