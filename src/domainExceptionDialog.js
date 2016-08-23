var hasRun = false;

/**
 * Add the whitelist dialog to a window, called by webrequest.js:_askUserToWhitelist
 */
chrome.runtime.onConnect.addListener(
  function(port){

    port.onMessage.addListener(function(msg){
      //html for dialog window that pops up
      //TODO: templating for this.
      var dialog = '<div id="pbDialogContainer"></div>' +
      '<div id="pbDialog" class="privacyBadgerDialog">' +
      '<div id="closeWindow">X</div>'+
      '<div id="pbLogo"><img src="' + chrome.extension.getURL("icons/badger-48.png") + '"></div>'+
      '<h2>' + chrome.i18n.getMessage("ded_privacy_badger_alert") + '</h2>' +
      '<div class="clear"></div>' +
      '<h3>'+ chrome.i18n.getMessage("ded_logging_into")  + msg.whitelistDomain + chrome.i18n.getMessage("ded_can_allow_to_track") + '</h3>' +
      '<button class="pbButton default" id="allow_once">' + chrome.i18n.getMessage("ded_only_allow") + msg.whitelistDomain + chrome.i18n.getMessage("ded_on") + msg.currentDomain + '</button>' +
      '<button class="pbButton" id="allow_all">' + chrome.i18n.getMessage("ded_always_allow") + msg.whitelistDomain + '</button>' +
      '<button class="pbButton" id="never">' + chrome.i18n.getMessage("ded_never_allow") + msg.whitelistDomain + '</button>' +
      '<a id="useless"></a>' + 
      '</div>';

      if(msg.action == "attemptWhitelist"){
        // Avoid running this dialog more than once per page, since that is
        // most likely to happen due to some horrible retry loop
        if(hasRun){ return; }
        hasRun = true;
        
        //Create a dialog box element and show it
        var body = document.getElementsByTagName('body')[0];
        var diagBox = document.createElement('div');
        diagBox.innerHTML = dialog;
        body.appendChild(diagBox);


        //add click handler to dialog buttons
        var buttons = document.getElementsByClassName("pbButton");
        for(var i =0; i < buttons.length; i++){
          var elem = buttons[i];   
          elem.addEventListener('click',function(e){ // eslint-disable-line no-loop-func
            var action = e.currentTarget.id;
            port.postMessage({action: action});

            diagBox.parentNode.removeChild(diagBox);
            for (var prop in diagBox) { delete diagBox[prop]; }
            document.removeEventListener('keydown', keypressListener);

            e.preventDefault();
          });
        }

        document.getElementById('useless').click();

        var closeWindow = function(e){
          document.removeEventListener('keydown', keypressListener);
          document.removeEventListener('click', keypressListener);

          port.postMessage({action: 'no_action'});

          diagBox.parentNode.removeChild(diagBox);
          for (var prop in diagBox) { delete diagBox[prop]; }
          if(e){
            e.preventDefault();
          }
        };
        //click handler for close button
        var closeBtn = document.getElementById('closeWindow');
        closeBtn.onclick = closeWindow;

        var docCtr = document.getElementById('pbDialogContainer');
        docCtr.onclick = closeWindow;
        

        
        //keypress handlers
        var K_ENTER = 13;
        var K_TAB = 9;
        var K_ESC = 27;

        //number of times tab was pressed, used to determine idx of default option
        var tab_count = 0;

        var keypressListener = function(e){
          switch(e.keyCode){
            case K_ENTER:
              e.preventDefault();
              document.getElementsByClassName("pbButton default")[0].click();
              break;
            case K_TAB:
              e.preventDefault();
              var cur_idx = tab_count % 3;
              tab_count += 1;
              var new_idx = tab_count % 3;
              var buttons = document.getElementsByClassName("pbButton");
              var oldButton = buttons[cur_idx];
              var newButton = buttons[new_idx];
              oldButton.className = oldButton.className.replace(/\bdefault\b/, '');
              newButton.className += ' default';
              break;
            case K_ESC:
              e.preventDefault();
              closeWindow();
              break;
            default:
              break;
          }
        };
        document.addEventListener('keydown', keypressListener);

      }
    });

  }
);

