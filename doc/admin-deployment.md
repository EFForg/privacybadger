# Privacy Badger enterprise deployment and configuration

Administrators can configure Privacy Badger on managed devices by setting up a policy.

You can find the full list of available settings in [Privacy Badger's managed storage schema](/src/data/schema.json). Please [let us know](https://privacybadger.org/#I-found-a-bug%21-What-do-I-do-now) if you'd like to set something that isn't yet supported.

Note that Privacy Badger currently reads and applies settings from [managed storage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/managed) on startup. To see your policy take effect on a managed device, first restart that device's browser.


## Firefox setup

1. Locate and if necessary create the [managed storage manifests folder](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#Manifest_location). Note that on Windows you need to create a registry key that points to the manifest's location.
2. Copy the [sample managed storage manifest for Firefox](/doc/jid1-MnnxcxisBPnSXQ@jetpack.json) to this folder.

If your Privacy Badgers were installed from [Privacy Badger's homepage](https://privacybadger.org) (not from [AMO](https://addons.mozilla.org/en-US/firefox/addon/privacy-badger17/)):

3. Rename the manifest to `jid1-MnnxcxisBPnSXQ-eff@jetpack.json`.
4. Similarly, update the `"name"` property in the manifest to `"jid1-MnnxcxisBPnSXQ-eff@jetpack"`.


## Chrome/Chromium setup

Please review the [Configuring Apps and Extensions by Policy](http://www.chromium.org/administrators/configuring-policy-for-extensions) document.

Notes for Chrome OS and Linux follow.

### Chrome OS

The following example JSON policy disables Privacy Badger on `example.com`. This means Privacy Badger will be disabled when you visit any `example.com` page.

```json
{
    "disabledSites": {
        "Value": [
            "example.com"
        ]
    },
    "showIntroPage": {
        "Value": false
    }
}
```

### Linux

1. Locate and if necessary create the [managed policies folder for Chrome or Chromium](http://www.chromium.org/administrators/configuring-policy-for-extensions).
2. Copy the [sample managed storage manifest for Chrome](/doc/sample-managed-storage-manifest-chrome.json) to this folder.
3. Rename the manifest file to whatever you like (perhaps `privacy-badger-admin-settings.json`).
4. Update the extension ID inside the manifest if you are not using official Privacy Badger releases from Chrome Web Store.
