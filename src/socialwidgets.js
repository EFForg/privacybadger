/**
 * The absolute path to the replacement buttons folder.
 */
var REPLACEMENT_BUTTONS_FOLDER_PATH = chrome.extension.getURL("skin/socialwidgets/");

/**
 * The absolute path to the stylesheet that is injected into every page.
 */
var CONTENT_SCRIPT_STYLESHEET_PATH = chrome.extension.getURL("skin/socialwidgets.css");

/**
 * Initializes the content script.
 */
function initialize() {
	getTrackerData(function (trackers, trackerButtonsToReplace) {
		// add the Content.css stylesheet to the page
		var head = document.querySelector("head");
		var stylesheetLinkElement = getStylesheetLinkElement(CONTENT_SCRIPT_STYLESHEET_PATH);
		head.appendChild(stylesheetLinkElement);
		
		replaceTrackerButtonsHelper(trackers, trackerButtonsToReplace);
	});
}

/**
 * Creates a replacement button element for the given tracker.
 *
 * @param {Tracker} tracker the Tracker object for the button
 * 
 * @return {Element} a replacement button element for the tracker
 */
function createReplacementButtonImage(tracker) {
	var buttonData = tracker.replacementButton;

	var button = document.createElement("img");
	
	var buttonUrl = getReplacementButtonUrl(buttonData.imagePath);
	var buttonType = buttonData.type;
	var details = buttonData.details;
	
	button.setAttribute("src", buttonUrl);
	button.setAttribute("class", "privacyBadgerReplacementButton");
	button.setAttribute("title", "PrivacyBadger has replaced this " + tracker.name
		+ " button.");
	
	switch (buttonType) {
		case 0: // normal button type; just open a new window when clicked
			var popupUrl = details + encodeURIComponent(window.location.href);
			
			button.addEventListener("click", function() {
				window.open(popupUrl);
			});
		break;
		
		case 1: // in place button type; replace the existing button with an
		        // iframe when clicked
			var iframeUrl = details + encodeURIComponent(window.location.href);
			
			button.addEventListener("click", function() {
				// for some reason, the callback function can execute more than
				// once when the user clicks on a replacement button
				// (it executes for the buttons that have been previously
				// clicked as well)
				replaceButtonWithIframeAndUnblockTracker(button, details, iframeUrl);
			});
		break;
		
		case 2: // in place button type; replace the existing button with code
		        // specified in the Trackers file
			button.addEventListener("click", function() {
				// for some reason, the callback function can execute more than
				// once when the user clicks on a replacement button
				// (it executes for the buttons that have been previously
				// clicked as well)
				replaceButtonWithHtmlCodeAndUnblockTracker(button, details, details);
			});
		break;
		
		default:
			throw "Invalid button type specified: " + buttonType;
		break;
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
 * Returns a HTML link element for a stylesheet at the given URL.
 * 
 * @param {String} URL the URL of the stylesheet to link
 * 
 * @return {Element} the HTML link element for a stylesheet at the given URL
 */
function getStylesheetLinkElement(url) {
	var linkElement = document.createElement("link");
	
	linkElement.setAttribute("rel", "stylesheet");
	linkElement.setAttribute("type", "text/css");
	linkElement.setAttribute("href", url);
	
	return linkElement;
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
 * @param {String} html the HTML code that should replace the button
 */
function replaceButtonWithHtmlCodeAndUnblockTracker(button, tracker, html) {
	unblockTracker(tracker, function() {
		// check is needed as for an unknown reason this callback function is
		// executed for buttons that have already been removed; we are trying
		// to prevent replacing an already removed button
		if (button.parentNode !== null) { 
			var codeContainer = document.createElement("div");
			codeContainer.innerHTML = html;
			
			button.parentNode.replaceChild(codeContainer, button);
			
			button.removeEventListener("click");
		}
	});
}

/**
 * Replaces all tracker buttons on the current web page with the internal
 * replacement buttons, respecting the user's blocking settings.
 * 
 * @param {Array} trackers an array of Tracker objects
 * @param {Object} a map of Tracker names to Boolean values saying whether
 *                 those trackers' buttons should be replaced
 */
function replaceTrackerButtonsHelper(trackers, trackerButtonsToReplace) {
	trackers.forEach(function(tracker) {
		var replaceTrackerButtons = trackerButtonsToReplace[tracker.name];
				
		if (replaceTrackerButtons) {	
			console.log("replacing tracker button for " + tracker.name);	
			// makes a comma separated list of CSS selectors that specify
			// buttons for the current tracker; used for document.querySelectorAll
			var buttonSelectorsString = tracker.buttonSelectors.toString();
			var buttonsToReplace =
				document.querySelectorAll(buttonSelectorsString);

			for (var i = 0; i < buttonsToReplace.length; i++) {
				var buttonToReplace = buttonsToReplace[i];
				
				var button =
					createReplacementButtonImage(tracker);
				
				buttonToReplace.parentNode.replaceChild(button, buttonToReplace);
			}
		}
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
	chrome.runtime.sendMessage({checkReplaceButton:document.location}, function(response) {
		var trackers = response.trackers;
		var trackerButtonsToReplace = response.trackerButtonsToReplace;
		callback(trackers, trackerButtonsToReplace);
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
function unblockTracker(buttonUrl, callback) {
	var request = {
		"unblockSocialWidget" : true,
		"buttonUrl": buttonUrl
	};
	chrome.runtime.sendMessage(request, callback);
}

initialize();
