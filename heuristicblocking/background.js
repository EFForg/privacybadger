tabOrigins = { };

chrome.webRequest.onBeforeRequest.addListener(function(details) {
	// Ignore requests that are outside a tabbed window
	if(details.tabId < 0)
		return { };
	
	var origin = getBaseDomain(details.url);
	
	// Save the origin associated with the tab if this is a main window request
	if(details.type == "main_frame") {
		tabOrigins[details.tabId] = origin;
		return { };
	}
	else {
		var tabOrigin = tabOrigins[details.tabId];
		if (origin == tabOrigin)
			return { };
		else
			return { cancel: true };
	}
},
{urls: ["<all_urls>"]},
["blocking"]);