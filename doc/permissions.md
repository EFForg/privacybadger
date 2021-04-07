# Permissions

This document explains the need for each [extension permission](https://developer.chrome.com/docs/extensions/mv3/declare_permissions/) declared in Privacy Badger's [extension manifest](/src/manifest.json).

## Privacy
The Privacy API lets extensions modify browser-wide privacy settings. Privacy Badger uses the Privacy API to disable:

- [hyperlink auditing](https://www.bleepingcomputer.com/news/software/major-browsers-to-prevent-disabling-of-click-tracking-privacy-risk/), an [HTML feature](https://html.spec.whatwg.org/multipage/links.html#hyperlink-auditing) meant to optimize and normalize click tracking on the Web
- [prefetching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Link_prefetching_FAQ) (network predictions), as it presents a poor tradeoff between privacy and perceived browsing performance
- suggestions for similar pages when a page can't be found, as this Chrome feature sends visited web addresses to Google

In addition, Privacy Badger allows users to set a stricter WebRTC IP handling policy in order to prevent leaking local network address information.

## Cookies
Privacy Badger needs access to the cookies API in order to detect and correct a common error where Cloudflare domains are identified as trackers and blocked.

## Storage
The storage API lets extensions store information that persists after the browser is closed. Privacy Badger uses it to save user settings and information it has learned about trackers.

## WebRequest
The WebRequest API allows extensions to observe all incoming and outgoing network requests made by the browser. Privacy Badger inspects request for tracking behavior, and logs the destinations of outgoing requests that are flagged as tracking. No information is ever shared outside of the browser.

## WebRequestBlocking
The blocking version of the WebRequest API allows extensions to modify or block network requests before they leave the browser. Privacy Badger uses this API to synchronously view, modify, and block requests to trackers. For example, Privacy Badger modifies requests made to domains on the yellowlist to remove the referer header and cookies.

## WebNavigation
This API allows extensions to detect when the user navigates from one web page to another. Privacy Badger needs this in order to correctly determine whether each request is a first-party request (to the same domain as the web page) or a third-party request (to somewhere else). This permission allows it to avoid misattributing trackers on special pages such as Service Worker pages.

## http://\*/\* and https://\*/\*
These permissions allow Privacy Badger to use the WebRequest and WebRequestBlocking permissions on requests to all websites. As described above, Privacy Badger uses these APIs to analyze requests and detect tracking, then modify or block requests to known trackers. No information is ever shared outside of the browser.

## Tabs
Privacy Badger needs access to the tabs API so that the extension can detect which tab is active and which tabs are simply present in the background. The extension icon, badge and popup update to reflect the state of Privacy Badger. This often requires knowing the tab's URL. For example, updating the icon requires the URL in order to determine whether Privacy Badger should be shown as disabled on that tab. Privacy Badger also uses the tabs API for miscellaneous tasks such as opening or switching to the already open new user welcome page.
