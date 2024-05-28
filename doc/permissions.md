# Permissions

This document explains the need for each [extension permission](https://developer.chrome.com/docs/extensions/mv3/declare_permissions/) declared in Privacy Badger's [extension manifest](/src/manifest.json).

## Privacy
The Privacy API lets extensions modify browser-wide privacy settings. Privacy Badger uses the Privacy API to disable:

- [hyperlink auditing](https://www.bleepingcomputer.com/news/software/major-browsers-to-prevent-disabling-of-click-tracking-privacy-risk/), an [HTML feature](https://html.spec.whatwg.org/multipage/links.html#hyperlink-auditing) meant to optimize and normalize click tracking on the Web
- [prefetching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Link_prefetching_FAQ) (network predictions), as it presents a poor tradeoff between privacy and perceived browsing performance
- suggestions for similar pages when a page can't be found, as this Chrome feature sends visited web addresses to Google
- Google's Topics API

## Storage
The storage API lets extensions store information that persists after the browser is closed. Privacy Badger uses it to save user settings and information it has learned about trackers.

## WebRequest
The WebRequest API allows extensions to observe all incoming and outgoing network requests made by the browser. When learning what to block, Privacy Badger inspects requests for tracking behavior. Privacy Badger also uses webRequest to report what happened on a particular tab. No information is ever shared outside of the browser.

## Declarative Net Request
Privacy Badger uses the Declarative Net Request (DNR) API to block or modify requests to trackers. For example, Privacy Badger removes cookie headers from requests to and responses from "cookieblocked" domains.

Privacy Badger also uses DNR to send Global Privacy Control and Do Not Track signals to websites via HTTP headers.

## WebNavigation
This API allows extensions to detect when the user navigates from one web page to another. Privacy Badger needs this in order to correctly determine whether each request is a first-party request (to the same domain as the web page) or a third-party request (to somewhere else). This permission allows it to avoid misattributing trackers on special pages such as Service Worker pages.

## \<all\_urls\> host permissions
Global (applying to all sites) host permissions allow Privacy Badger to perform the following actions on all websites: to block trackers, to deny "cookieblocked" domains access to cookie headers and to JavaScript storage, to report what happened on a particular tab in Privacy Badger's browser popup, to send GPC/DNT signals, and to detect tracking, when learning is enabled. No information is ever shared outside of the browser.

## Tabs
Privacy Badger needs access to the tabs API so that the extension can detect which tab is active and which tabs are simply present in the background. The extension icon, badge and popup update to reflect the state of Privacy Badger. This often requires knowing the tab's URL. For example, updating the icon requires the URL in order to determine whether Privacy Badger should be shown as disabled on that tab. Privacy Badger also uses the tabs API for miscellaneous tasks such as opening or switching to the already open new user welcome page.

## Alarms
Privacy Badger uses the Alarms API to temporarily ensure the background process does not get terminated as idle when Privacy Badger needs it to perform some longer running asynchronous task. This workaround is used to help reopen the welcome page when it appears that the extension has been restarted because of interaction with the Private/Incognito browsing permission prompt, but not because of idle background process termination.

## Scripting
Privacy Badger uses the Scripting API to send Global Privacy Control and Do Not Track signals to websites via JavaScript, as well as to deny "cookieblocked" domains JavaScript access to cookies and localStorage.
