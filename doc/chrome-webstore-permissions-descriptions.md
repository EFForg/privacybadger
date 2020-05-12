# Privacy tab in chrome web store:
-----------------------------------

## Permissions:

#### Privacy -
Privacy Badger needs access to the privacy API so that it can restrict the webRTCIPHandlingPolicy so that none of the user's local address information is exposed. If the user is in an incognito window, it will override and disable the alternateErrorPagesEnabled and hyperlinkAuditingEnabled settings.

#### Cookies -
Privacy Badger needs access to the cookies API in order to correct when Cloudflare domains are incorrectly identified as trackers.

#### Storage -
Privacy Badger needs access to the storage API so that the extension's storage and user's settings will persist beyond a browser session.

#### WebRequest -
Privacy Badger needs access to the WebRequest API so that it can view and intercept network requests being made in the browser. If user tracking is taking place via network request headers, Privacy Badger needs to be able to intercept and modify those headers. It views and then asynchronously logs the destination for outgoing requests that's flagged as tracking the user.

#### WebRequestBlocking -
Privacy Badger needs access to the WebRequestBlocking API so that it can synchronously view and intercept network requests being made in the browser. For example, it will check headers on outgoing requests to strip referer and cookie values, as well as to add the Do Not Track header.

#### webNavigation -
Privacy Badger needs access to the webNavigation API in order to establish a listener for when the user navigates from their current page. This is to avoid misattributing trackers on special pages such as Service Worker pages that do not go through WebRequest listeners.

#### http://\*/\*
#### https://\*/\*  -
Privacy Badger needs broad permissions across all url patterns so that it can perform its tracking detection on all websites the user may visit.

#### tabs -
Privacy Badger needs access to the tabs API so that the extension can detect which tab is active and which are simply present. The extension popup and badge update to reflect state of Privacy Badger on the active tab.
