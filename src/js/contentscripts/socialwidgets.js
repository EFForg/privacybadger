/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 * Derived from ShareMeNot
 * Copyright (C) 2011-2014 University of Washington
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * ShareMeNot is licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2011-2014 University of Washington
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * Social widget tracker data, read from file.
 */
let trackerInfo;

let i18n = chrome.i18n;


/**
 * Initializes the content script.
 */
function initialize() {
  // Get tracker info and check for initial blocks (that happened
  // before content script was attached)
  getTrackerData(function (trackers, trackerButtonsToReplace) {
    trackerInfo = trackers;
    replaceInitialTrackerButtonsHelper(trackerButtonsToReplace);
  });

  // Set up listener for blocks that happen after initial check
  chrome.runtime.onMessage.addListener(function(request/*, sender, sendResponse*/) {
    if (request.replaceSocialWidget) {
      replaceSubsequentTrackerButtonsHelper(request.trackerDomain);
    }
  });
}

/**
 * Creates a replacement button element for the given tracker.
 *
 * @param {Tracker} tracker the Tracker object for the button
 *
 * @param {Element} trackerElem the tracking element that we are replacing
 *
 * @param {Function} callback called with the replacement button element for the tracker
 */
function createReplacementButtonImage(tracker, trackerElem, callback) {
  var buttonData = tracker.replacementButton;

  // already have replace button image URI cached
  if (buttonData.buttonUrl) {
    return setTimeout(function () {
      _createReplacementButtonImageCallback(tracker, trackerElem, callback);
    }, 0);
  }

  if (buttonData.loading) {
    return setTimeout(function () {
      createReplacementButtonImage(tracker, trackerElem, callback);
    }, 10);
  }

  // don't have image data cached yet, get it from the background page
  buttonData.loading = true;
  chrome.runtime.sendMessage({
    getReplacementButton: buttonData.imagePath
  }, function (response) {
    buttonData.buttonUrl = response; // cache image data
    _createReplacementButtonImageCallback(tracker, trackerElem, callback);
  });
}

function _createReplacementButtonImageCallback(tracker, trackerElem, callback) {
  var buttonData = tracker.replacementButton;

  var button = document.createElement("img");

  var buttonUrl = buttonData.buttonUrl;
  var buttonType = buttonData.type;
  var details = buttonData.details;

  button.setAttribute("src", buttonUrl);
  button.setAttribute("title", i18n.getMessage("social_tooltip_pb_has_replaced") +
                            tracker.name + i18n.getMessage("social_tooltip_button"));
  button.setAttribute(
    "style",
    "border: none !important; cursor: pointer !important; height: auto !important; width: auto !important;"
  );

  switch (buttonType) {
    case 0: // normal button type; just open a new window when clicked
      var popupUrl = details + encodeURIComponent(window.location.href);

      button.addEventListener("click", function() {
        window.open(popupUrl);
      });

      break;

    // in place button type; replace the existing button
    // with an iframe when clicked
    case 1:
      var iframeUrl = details + encodeURIComponent(window.location.href);

      button.addEventListener("click", function() {
        replaceButtonWithIframeAndUnblockTracker(button, buttonData.unblockDomains, iframeUrl);
      }, { once: true });

      break;

    // in place button type; replace the existing button with code
    // specified in the Trackers file
    case 2:
      button.addEventListener("click", function() {
        replaceButtonWithHtmlCodeAndUnblockTracker(button, buttonData.unblockDomains, details);
      }, { once: true });
      break;

    case 3:
      button.addEventListener("click", function() {
        replaceButtonWithHtmlCodeAndUnblockTracker(button, buttonData.unblockDomains, trackerElem);
      }, { once: true });
      break;

    default:
      throw "Invalid button type specified: " + buttonType;
  }

  callback(button);
}


/**
 * Unblocks the given tracker and replaces the given button with an iframe
 * pointing to the given URL.
 *
 * @param {Element} button the DOM element of the button to replace
 * @param {Tracker} tracker the Tracker object for the tracker that should be
 *                          unblocked
 * @param {String} iframeUrl the URL of the iframe to replace the button
 */
function replaceButtonWithIframeAndUnblockTracker(button, tracker, iframeUrl) {
  unblockTracker(tracker, function() {
    // check is needed as for an unknown reason this callback function is
    // executed for buttons that have already been removed; we are trying
    // to prevent replacing an already removed button
    if (button.parentNode !== null) {
      var iframe = document.createElement("iframe");

      iframe.setAttribute("src", iframeUrl);
      iframe.setAttribute("style", "border: none !important; height: 1.5em !important;");

      button.parentNode.replaceChild(iframe, button);
    }
  });
}

/**
 * Unblocks the given tracker and replaces the given button with the
 * HTML code defined in the provided Tracker object.
 *
 * @param {Element} button the DOM element of the button to replace
 * @param {Tracker} tracker the Tracker object for the tracker that should be
 *                          unblocked
 * @param {(String|Element)} html an HTML string or DOM Element that should replace the button
 */
function replaceButtonWithHtmlCodeAndUnblockTracker(button, tracker, html) {
  unblockTracker(tracker, function() {
    // check is needed as for an unknown reason this callback function is
    // executed for buttons that have already been removed; we are trying
    // to prevent replacing an already removed button
    if (button.parentNode !== null) {
      var codeContainer = document.createElement("div");
      if (typeof html == "string") {
        codeContainer.innerHTML = html;
      } else {
        codeContainer.innerHTML = html.outerHTML;
      }

      button.parentNode.replaceChild(codeContainer, button);

      replaceScriptsRecurse(codeContainer);
    }
  });
}

/**
 * Dumping scripts into innerHTML won't execute them, so replace them
 * with executable scripts.
 */
function replaceScriptsRecurse(node) {
  if (node.getAttribute && node.getAttribute("type") == "text/javascript") {
    var script = document.createElement("script");
    script.text = node.innerHTML;
    script.src = node.src;
    node.parentNode.replaceChild(script, node);
  } else {
    var i = 0;
    var children = node.childNodes;
    while (i < children.length) {
      replaceScriptsRecurse(children[i]);
      i++;
    }
  }
  return node;
}


/**
 * Replaces all tracker buttons on the current web page with the internal
 * replacement buttons, respecting the user's blocking settings.
 *
 * @param {Object} a map of Tracker names to Boolean values saying whether
 *                 those trackers' buttons should be replaced
 */
function replaceInitialTrackerButtonsHelper(trackerButtonsToReplace) {
  trackerInfo.forEach(function(tracker) {
    var replaceTrackerButtons = trackerButtonsToReplace[tracker.name];
    if (replaceTrackerButtons) {
      replaceIndividualButton(tracker);
    }
  });
}

/**
 * Individually replaces tracker buttons blocked after initial check.
 */
function replaceSubsequentTrackerButtonsHelper(trackerDomain) {
  if (!trackerInfo) { return; }
  trackerInfo.forEach(function(tracker) {
    var replaceTrackerButtons = (tracker.domain == trackerDomain);
    if (replaceTrackerButtons) {
      replaceIndividualButton(tracker);
    }
  });
}

/**
 * Actually do the work of replacing the button.
 */
function replaceIndividualButton(tracker) {

  // makes a comma separated list of CSS selectors that specify
  // buttons for the current tracker; used for document.querySelectorAll
  var buttonSelectorsString = tracker.buttonSelectors.toString();
  var buttonsToReplace =
    document.querySelectorAll(buttonSelectorsString);

  buttonsToReplace.forEach(function (buttonToReplace) {
    console.log("Replacing social widget for " + tracker.name);

    createReplacementButtonImage(tracker, buttonToReplace, function (button) {
      buttonToReplace.parentNode.replaceChild(button, buttonToReplace);
    });
  });
}

/**
* Gets data about which tracker buttons need to be replaced from the main
* extension and passes it to the provided callback function.
*
* @param {Function} callback the function to call when the tracker data is
*                            received; the arguments passed are the folder
*                            containing the content script, the tracker
*                            data, and a mapping of tracker names to
*                            whether those tracker buttons need to be
*                            replaced
*/
function getTrackerData(callback) {
  chrome.runtime.sendMessage({checkReplaceButton:document.location.hostname}, function(response) {
    if (response) {
      var trackers = response.trackers;
      var trackerButtonsToReplace = response.trackerButtonsToReplace;
      callback(trackers, trackerButtonsToReplace);
    }
  });
}

/**
* Unblocks the tracker with the given name from the page. Calls the
* provided callback function after the tracker has been unblocked.
*
* @param {String} trackerName the name of the tracker to unblock
* @param {Function} callback the function to call after the tracker has
*                            been unblocked
*/
function unblockTracker(buttonUrls, callback) {
  var request = {
    "unblockSocialWidget" : true,
    "buttonUrls": buttonUrls
  };
  chrome.runtime.sendMessage(request, callback);
}

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

(function () {

// don't inject into non-HTML documents (such as XML documents)
// but do inject into XHTML documents
if (document instanceof HTMLDocument === false && (
  document instanceof XMLDocument === false ||
  document.createElement('div') instanceof HTMLDivElement === false
)) {
  return;
}

chrome.runtime.sendMessage({
  checkSocialWidgetReplacementEnabled: true
}, function (checkSocialWidgetReplacementEnabled) {
  if (!checkSocialWidgetReplacementEnabled) {
    return;
  }
  initialize();
});

}());
