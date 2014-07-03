console.log('hi from domain exception');

chrome.runtime.onConnect.addListener(
  function(port){

    port.onMessage.addListener(function(msg){
      var dialog = '<div id="pbDialog" class="privacyBadgerDialog">' +
      '<h2> Privacy Badger Alert!</h2>' +
      '<h3>Logging into ' + msg.whitelistDomain + ' allows them to track you around the web.</h3>' +
      '<button class="pbButton" id="allow_all">Allow ' + msg.whitelistDomain + ' always.</button>' +
      '<button class="pbButton" id="allow_once">Allow ' + msg.whitelistDomain + ' on this site only.</button>' +
      '<button class="pbButton" id="never">Do not allow ' + msg.whitelistDomain + ' this time.</button>' +
      '</div>';
      if(msg.action == "attemptWhitelist"){
        console.log('attempting whitelist');
        var body = document.getElementsByTagName('body')[0];
        var diagBox = document.createElement('div');
        diagBox.innerHTML = dialog;
        body.appendChild(diagBox);
        var buttons = document.getElementsByClassName("pbButton");
        for(var i =0; i < buttons.length; i++){
          var elem = buttons[i];   
          elem.addEventListener('mouseup',function(e){
            var action = e.currentTarget.id;
            port.postMessage({action: action});

            diagBox.parentNode.removeChild(diagBox);
            for (var prop in diagBox) { delete diagBox[prop]; }

            return false;
          })
        }
      }
    });

  }
);

