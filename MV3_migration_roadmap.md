# Roadmap to Migrating to Manifest V3

*this document will be deleted in a final commit before any changes get merged into master*

This is very much a WIP.
It's a task list, a list of relevant resources, and potentially somewhere to bounce ideas about how Privacy Badger could evolve in a post MV3 context.
We know that much of the `webRequest` API changing to `declarativeNetRequest` will break core functionality of Privacy Badger. How could Privacy Badger remain a useful and easy-to-use tool with mostly just observational capabilities in the Chrome browser?

### Timeline


### Links
* [declarativeNetRequest API documentation](https://developer.chrome.com/extensions/declarativeNetRequest)
* [Google group discussion about changing webRequest API](https://groups.google.com/a/chromium.org/forum/#!topic/chromium-extensions/veJy9uAwS00%5B151-175%5D)
* [chrome developer guide to migrating to v3](https://developer.chrome.com/extensions/migrating_to_manifest_v3)
* [chrome developer guide to migrating from Background Pages to Service Workers](https://developer.chrome.com/extensions/migrating_to_service_workers)
* [chrome design document (hasn't been updated in a while)](https://docs.google.com/document/d/1nPu6Wy4LWR66EFLeYInl3NzzhHzc-qnk4w4PX-0XMw8/edit)
* [chromium issue discussing MV3 implementation](https://bugs.chromium.org/p/chromium/issues/detail?id=896897)

## Tasklist:

#### in manifest.json:
- [ ] change `manifest_version` from `2` to `3`
- [ ] change `permissions` into `host_permissions`
- [ ] change `background.scripts` into `background.service_worker`
- [ ] change value in `background.service_worker` from an array to a string of the relative path to the root service worker
- [ ] change `browser_action` into `action`

#### in the JavaScript:
- [ ] replace all instances of `chrome.browserAction` with `chrome.action`
- [ ] replace all instances of `chrome.webRequest` with `chrome.declarativeNetRequest`
- [ ] migrate all `chrome.extension.getBackgroundPage` to other messaging contexts and/or `background.service_worker` scripts defined in the manifest
