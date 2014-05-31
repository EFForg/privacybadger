require.scopes["socialwidgetloader"] = (function() {

var exports = {};
exports.loadSocialWidgetsFromFile = loadSocialWidgetsFromFile;

/**
 * Loads a JSON file at filePath and returns the parsed object.
 * 
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @return {Object} the JSON at the file at filePath
 */
function loadJSONFromFile(filePath) {
	var jsonString = getFileContents(filePath);
	var jsonParsed = JSON.parse(jsonString);
	Object.freeze(jsonParsed); // prevent modifications to jsonParsed
	
	return jsonParsed;
}

/**
 * Returns the contents of the file at filePath.
 * 
 * @param {String} filePath the path to the file
 * 
 * @return {String} the contents of the file
 */
function getFileContents(filePath) {
	var url = chrome.extension.getURL(filePath);
	
	var request = new XMLHttpRequest();
	request.open("GET", url, false);
	request.send();
	
	return request.responseText;
}

/**
 * Returns an array of SocialWidget objects that are loaded from the file at
 * filePath.
 * 
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @return {Array} an array of SocialWidget objects that are loaded from the file at
 *                 filePath
 */
function loadSocialWidgetsFromFile(filePath) {
	var socialwidgets = [];
	var socialwidgetsJson = loadJSONFromFile(filePath);
	
	// loop over each socialwidget, making a SocialWidget object
	for (var socialwidgetName in socialwidgetsJson) {
		var socialwidgetProperties = socialwidgetsJson[socialwidgetName];
		var socialwidgetObject = new SocialWidget(socialwidgetName, socialwidgetProperties);
		socialwidgets.push(socialwidgetObject);
	}
	
	return socialwidgets;
}

/**
 * Constructs a SocialWidget with the given name and properties.
 * 
 * @param {String} name the name of the socialwidget
 * @param {Object} properties the properties of the socialwidget
 */
function SocialWidget(name, properties) {
	this.name = name;
	
	for (var property in properties) {
		this[property] = properties[property];
	}
}

return exports;
})(); //require scopes
