# Privacy tab in chrome web store:
-----------------------------------

## Permissions:

#### Privacy -
The Privacy API lets extensions modify browser-wide privacy settings. Privacy Badger uses it to disable a setting that lets Chrome send third-party requests to resolve errors, and to turns off link tracking via the HTML ping attribute. We also give users the option to change their WebRTC privacy level in order to prevent leaking local network address information.

#### Cookies -
Privacy Badger needs access to the cookies API in order to detect and correct a common error where Cloudflare domains are identified as trackers and blocked.

#### Storage -
The storage API lets extensions store information that persists after the browser is closed. Privacy Badger uses it to save user settings and information it has learned about trackers.

#### WebRequest -
The WebRequest API allows extensions to observe all incoming and outgoing network requests made by the browser. Privacy Badger inspects request for tracking behavior, and logs the destinations of outgoing requests that are flagged as tracking. No information is ever shared outside of the browser.

#### WebRequestBlocking -
The blocking version of the WebRequest API allows extensions to modify or block network requests before they leave the browser. Privacy Badger uses this API to synchronously view, modify, and block requests to trackers. For example, Privacy Badger modifies requests made to domains on the yellowlist to remove the referer header and cookies.

#### webNavigation -
This API allows extensions to detect when the user navigates from one web page to another. Privacy Badger needs this in order to correctly determine whether each request is a first-party request (to the same domain as the web page) or a third-party request (to somewhere else). This permission allows it to avoid misattributing trackers on special pages such as Service Worker pages.

#### http://\*/\*
#### https://\*/\*  -
These permissions allow Privacy Badger to use the WebRequest and WebRequestBlocking permissions on requests to all websites. As described above, Privacy Badger uses these APIs to analyze requests and detect tracking, then modify or block requests to known trackers. No information is ever shared outside of the browser.

#### tabs - 
Privacy Badger needs access to the tabs API so that the extension can detect which tab is active and which are simply present in the background. The extension pop-up and badge update to reflect state of Privacy Badger on the active tab.
