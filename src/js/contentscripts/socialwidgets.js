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
/* globals chrome, document, window, console*/

/**
 * Social widget tracker data, read from file.
 */
let trackerInfo;
let styleSheetAdded = false;

let REPLACEMENT_BUTTONS_FOLDER_PATH = chrome.extension.getURL("skin/socialwidgets/");
let STYLESHEET_URL = chrome.extension.getURL("skin/socialwidgets/socialwidgets.css");


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
 * Add socialwidgets.css This function is idempotent, so it only adds the css
 * once, even if called multiple times.
 */
function addStyleSheet() {
  if (styleSheetAdded) {
    return;
  }
  // add the Content.css stylesheet to the page
  let link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = STYLESHEET_URL;

  let head = document.querySelector("head");
  if (head !== null) {
    head.appendChild(link);
    styleSheetAdded = true;
  }
}


/**
 * Creates a replacement button element for the given tracker.
 *
 * @param {Tracker} tracker the Tracker object for the button
 *
 * @param {Element} trackerElem the tracking element that we are replacing
 *
 * @return {Element} a replacement button element for the tracker
 */
function createReplacementButtonImage(tracker, trackerElem) {
  var buttonData = tracker.replacementButton;

  var button = document.createElement("img");

  var buttonUrl = getReplacementButtonUrl(buttonData.imagePath);
  var buttonType = buttonData.type;
  var details = buttonData.details;

  button.setAttribute("src", buttonUrl);
  button.setAttribute("class", "privacyBadgerReplacementButton");
  button.setAttribute("title", "Privacy Badger has replaced this " +
                            tracker.name + " button.");

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
        // for some reason, the callback function can execute more than
        // once when the user clicks on a replacement button
        // (it executes for the buttons that have been previously
        // clicked as well)
        replaceButtonWithIframeAndUnblockTracker(button, buttonData.unblockDomains, iframeUrl);
      });

      break;

    // in place button type; replace the existing button with code
    // specified in the Trackers file
    case 2:
      button.addEventListener("click", function() {
        // for some reason, the callback function can execute more than
        // once when the user clicks on a replacement button
        // (it executes for the buttons that have been previously
        // clicked as well)
        replaceButtonWithHtmlCodeAndUnblockTracker(button, buttonData.unblockDomains, details);
      });
      break;

    case 3:
      button.addEventListener("click", function() {
        replaceButtonWithHtmlCodeAndUnblockTracker(button, buttonData.unblockDomains, trackerElem);
      });
      break;

    default:
      throw "Invalid button type specified: " + buttonType;
  }

  return button;
}

/**
 * Returns the absolute URL of a replacement button given its relative path
 * in the replacement buttons folder.
 *
 * @param {String} replacementButtonLocation the relative path of the
 * replacement button in the replacement buttons folder
 *
 * @return {String} the absolute URL of a replacement button given its relative
 * path in the replacement buttons folder
 */
function getReplacementButtonUrl(replacementButtonLocation) {
  return REPLACEMENT_BUTTONS_FOLDER_PATH + replacementButtonLocation;
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
      iframe.setAttribute("class", "privacyBadgerOriginalButton");

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

      button.removeEventListener("click");
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

  for (var i = 0; i < buttonsToReplace.length; i++) {
    var buttonToReplace = buttonsToReplace[i];
    console.log("Replacing social widget for " + tracker.name);

    var button =
      createReplacementButtonImage(tracker, buttonToReplace);

    addStyleSheet();
    buttonToReplace.parentNode.replaceChild(button, buttonToReplace);
  }
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

chrome.runtime.sendMessage({
  checkSocialWidgetReplacementEnabled: true
}, function (checkSocialWidgetReplacementEnabled) {
  if (!checkSocialWidgetReplacementEnabled) {
    return;
  }
  initialize();
});
