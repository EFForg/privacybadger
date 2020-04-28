Privacy tab in chrome web store:
-----------------------------------

Permissions:

* `Privacy` -
Privacy Badger needs access to the privacy API so that it can view the user's current privacy settings such as their webRTCIPHandlingPolicy, then modify or make heuristic decisions on how to bolster their privacy

* `Cookies` -
Privacy Badger needs access to the cookies API so that it can detect and then prevent if any cookies are being placed on the user's browser to identify and track them.

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
Privacy Badger needs access to the tabs API so that it can detect which tabs are active, which web trackers are attributed to which domain, and which triggered event listeners belong to which tab on a user's browser.
