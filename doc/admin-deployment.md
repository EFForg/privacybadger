# Privacy Badger enterprise deployment and configuration

System administrators can configure Privacy Badger on managed devices by setting up an enterprise policy.

You can find the full list of available settings in [Privacy Badger's managed storage schema](/src/data/schema.json). Please [let us know](https://privacybadger.org/#I-found-a-bug%21-What-do-I-do-now) if you'd like to set something that isn't yet supported.

:warning: Note that Privacy Badger currently reads and applies settings from [managed storage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/managed) on startup. To see your policy take effect on a managed device, **first restart that device's browser**. :warning:


## Firefox

1. Locate and if necessary create the [managed storage manifests folder](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#Manifest_location). Note that on Windows you need to create a registry key that points to the manifest's location.
2. Copy the [sample managed storage manifest for Firefox](/doc/sample-admin-policies/jid1-MnnxcxisBPnSXQ@jetpack.json) to this folder.

If your Privacy Badgers were installed from [Privacy Badger's homepage](https://privacybadger.org) (not from [AMO](https://addons.mozilla.org/en-US/firefox/addon/privacy-badger17/)):

3. Rename the manifest to `jid1-MnnxcxisBPnSXQ-eff@jetpack.json`.
4. Similarly, update the `"name"` property in the manifest to `"jid1-MnnxcxisBPnSXQ-eff@jetpack"`.


## Chrome/Chromium

Review Chromium's [Documentation for Administrators](https://www.chromium.org/administrators/) documents, in particular [Configuring Apps and Extensions by Policy](http://www.chromium.org/administrators/configuring-policy-for-extensions).

See below for platform-specific tips.

### Chrome on Windows

Policy entries live at the following registry path:

```
HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\3rdparty\extensions\pkehgijcmpdhfbdbbnkijodmdjhbjlgp\policy
```

Use `REG_DWORD` for boolean values.

For example, to prevent the new user welcome page from launching upon Privacy Badger installation, create a `showIntroPage` entry set to a `REG_DWORD` value of `0`.


### Chrome on Linux

1. Locate and if necessary create the [managed policies folder for Chrome or Chromium](http://www.chromium.org/administrators/configuring-policy-for-extensions).
2. Copy the [sample managed storage manifest for Chrome](/doc/sample-admin-policies/sample-managed-storage-manifest-chrome.json) to this folder.
3. Rename the manifest file to whatever you like (perhaps `privacy-badger-admin-settings.json`).
4. Update the extension ID inside the manifest if you are not using official Privacy Badger releases from Chrome Web Store.

### Chrome OS

The following example JSON policy disables Privacy Badger on `example.com`. This means Privacy Badger will be disabled when you visit any `example.com` page.

This policy also prevents the new user welcome page from launching upon Privacy Badger installation.

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

### Chrome on Mac

Follow instructions [here](https://www.chromium.org/administrators/configuring-policy-for-extensions/#mac) to add an extension policy via plist file. Use [this plist file](/doc/sample-admin-policies/configuration.plist) as a template, subtituting the extension ID for the ID of your locally installed Privacy Badger.


## Edge

Same as [Chrome on Windows](#chrome-on-windows) but with a different registry path:

```
HKEY_LOCAL_MACHINE\Software\Policies\Microsoft\Edge\3rdparty\Extensions\mkejgcgkdlddbggjhhflekkondicpnop\policy
```
