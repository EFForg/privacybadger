# Admin deployment
###### Configuring Privacy Badger by administrators

Administrators can preconfigure Privacy Badger installations by setting up a "managed policy" configuration with their preferred defaults. Privacy Badgers process [managed storage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/managed) directives on startup. Any on/off settings get overwritten, while the disabled sites list is merged with the local list.

The managed policy configuration is a JSON file in Firefox on all platforms and in Chrome/Chromium on Linux. Chrome on other platforms is configured using other mechanisms like the registry and "plist" files. A brief setup overview follows.


## Firefox

1. Locate and if necessary create the [managed storage manifests folder](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#Manifest_location). Note that on Windows, you need to create a registry key that points to the manifest's location.
2. Copy the [sample managed storage manifest for Firefox](/doc/jid1-MnnxcxisBPnSXQ@jetpack.json) to this folder.
3. Rename the manifest to `jid1-MnnxcxisBPnSXQ-eff@jetpack.json` if you'd like to apply it to Privacy Badger installed from [EFF's website](https://www.eff.org/privacybadger). Do not rename the file when installing from [AMO](https://addons.mozilla.org/en-US/firefox/addon/privacy-badger17/).
4. Similarly, update the "name" property in the manifest if applying it to EFF-installed Privacy Badgers.


## Chrome/Chromium

### Linux

1. Locate and if necessary create the [managed policies folder for Chrome or Chromium](http://www.chromium.org/administrators/configuring-policy-for-extensions).
2. Copy the [sample managed storage manifest for Chrome](/doc/sample-managed-storage-manifest-chrome.json) to this folder.
3. Rename the manifest file to whatever you like (perhaps "privacy-badger-admin-settings.json").
4. Update the extension ID inside the manifest if you are not using official Privacy Badger releases from Chrome Web Store.

### Windows/macOS/Chrome OS

Please use the platform-specific examples in the [Configuring Apps and Extensions by Policy document](http://www.chromium.org/administrators/configuring-policy-for-extensions) to transform the [sample managed storage manifest for Chrome](/doc/sample-managed-storage-manifest-chrome.json) into your platform's configuration format.


## Define your administrator settings

Once the managed storage manifest is in place, update it to suit your needs. You can find the full list of available settings in [Privacy Badger's managed storage schema](/src/data/schema.json). Please let us know if you'd like to set something that isn't yet supported.
