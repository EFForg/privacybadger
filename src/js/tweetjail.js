(function() {
function receiveTweet(e) {
  let temp = document.createElement('div');
  temp.innerHTML += e.data;
  let tweet = temp.firstChild;

  let script = document.createElement('script');
  script.setAttribute('async', '');
  script.src = "https://platform.twitter.com/widgets.js";
  script.setAttribute('charset', 'utf-8');

  document.body.appendChild(tweet);
  document.body.appendChild(script);
  window.removeEventListener("message", receiveTweet);

  let observer = new MutationObserver(function(/* mutations */) {
    window.parent.postMessage({'width': document.body.scrollWidth, 'height': document.body.scrollHeight}, '*');
  });
   
  let config = {attributes: true};
  observer.observe(document.body, config);
}
window.addEventListener("message", receiveTweet, false);
window.parent.postMessage("ready", '*');
})();
