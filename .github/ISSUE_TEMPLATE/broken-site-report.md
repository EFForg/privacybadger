---
name: Broken Site Report
about: Report a broken site or site service

---

<!--

Is Privacy Badger breaking a site by blocking too much? We'd like to get it fixed; let's get some debugging information first.

Could you please visit Privacy Badger's background page, copy the following JavaScript, paste it into the background page console, replace "XXX" with the blocked domain, run it, and share the output? This should print the decisions your Badger reached for the domain and any related domains, and also the sites where Badger saw these domains perform tracking on.

```javascript
(function () {
  const STR = getBaseDomain("XXX");
  console.log("**** ACTION_MAP for", STR);
  _.each(badger.storage.getBadgerStorageObject('action_map').getItemClones(), (obj, domain) => {
    if (domain.indexOf(STR) != -1) console.log(domain, JSON.stringify(obj, null, 2));
  });
  console.log("**** SNITCH_MAP for", STR);
  _.each(badger.storage.getBadgerStorageObject('snitch_map').getItemClones(), (sites, domain) => {
    if (domain.indexOf(STR) != -1) console.log(domain, JSON.stringify(sites, null, 2));
  });
}());
```

To get to the background page console in Chrome, visit `chrome://extensions`, make sure "Developer mode" is enabled, click on the "background page" link in Privacy Badger's entry, and select the Console tab.

In Firefox, visit `about:debugging`, enable add-on debugging, click Debug next to Privacy Badger, click the OK button on the popup warning about remote debugging, and enter the above script into the console after the >>.

-->
