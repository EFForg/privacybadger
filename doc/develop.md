# Working with Privacy Badger's code

To make changes to Privacy Badger, you have to first load the extension from a source code checkout.


## Install from source

To install Privacy Badger from source in Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked" and select the [`src`](../src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the [`src/manifest.json`](../src/manifest.json) file. Note that this only installs the extension temporarily; it will be removed when you close Firefox.

To install Privacy Badger from source in Firefox for Android, please see [Mozilla's guide to developing extensions for Firefox for Android](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/) and [`web-ext` documentation](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/#testing-in-firefox-for-android).


## Send a pull request

Before submitting a pull request (PR), please review the sections below.

### Style guide

All JavaScript code going forward should use the following naming conventions:

- Objects and their properties should be Java or camelCase style.
- Primitive types should be Python or snake_case style.
- Constants should be ALL_CAPS.

Examples:

```javascript
const TRACKER_ENTROPY_THRESHOLD = 33;

let tab_id = details.tabId;

window.badger.getTrackerCount(tab_id);
```

### Catch errors early with static code analysis

First, install the exact expected version of [ESLint](https://eslint.org) by running `npm install` in your Privacy Badger source code checkout directory. You should then be able to produce a lint report by running `make lint` in the same directory.

You can review our set of ESLint rules in [`.eslintrc.yml`](/.eslintrc.yml). Files we want ESLint to ignore are specified in [`.eslintignore`](/.eslintignore).

### User interface considerations

If your PR updates Privacy Badger's user interface (UI):

- If there are new UI elements, are they keyboard accessible? Do they have sensible [focus order](https://www.w3.org/WAI/WCAG21/Understanding/focus-order)?
- Do we need to update dark mode styles?
- Do we need to make any fixes for right-to-left (RTL) locales?
- Do the changes look and work OK on smaller (mobile) displays?

### Commit messages

Please review the suggestions in this excellent [guide to writing commit messages](https://chris.beams.io/posts/git-commit/).
