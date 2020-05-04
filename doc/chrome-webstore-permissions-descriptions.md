Privacy tab in chrome web store:
-----------------------------------

Permissions:

* `Privacy` -
Privacy Badger needs access to the privacy API so that it can restrict the webRTCIPHandlingPolicy so that none of the user's local address information is exposed, as well as if they're in an incognito window, it will override and disable the alternateErrorPagesEnabled and hyperlinkAuditingEnabled settings.

* `Cookies` -
Privacy Badger needs access to the cookies API so that it can view cookies stored on the user's browser and detect if they're sent in requests to third party domains from the sites that a user visits for the purpose of tracking.

* `Storage` -
Privacy Badger needs access to the storage API so that the extension's storage and user's settings will persist beyond a browser session.

* `WebRequest` -
Privacy Badger needs access to the WebRequest API so that it can view and intercept network requests being made in the browser. If user tracking is taking place via network request headers, Privacy Badger needs to be able to intercept and modify those headers.

* `WebRequestBlocking` -
Privacy Badger needs access to the WebRequestBlocking API so that it can synchronously view and intercept network requests being made in the browser. If user tracking is taking place via network request headers, Privacy Badger needs to be able to intercept and modify those headers.

* `webNavigation` -
Privacy Badger needs access to the webNavigation API so that it can attach event listeners to the user's browser so that it knows when requests are being made to navigate to/from a page, then fire off it's actions to detect if/when tracking is taking place

* `http://*/*`
* `https://*/*`  -
Privacy Badger needs broad permissions across all url patterns so that it can perform its tracking detection on all websites the user may visit.

* `tabs` -
Privacy Badger needs access to the tabs API so that the extension can detect which tab is active and which are simply present. The extension popup and badge update to reflect state of Privacy Badger on the active tab.
