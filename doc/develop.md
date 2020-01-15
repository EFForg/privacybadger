# Working with Privacy Badger's code

To make changes to Privacy Badger, you have to first load the extension from a source code checkout.


## Install from source

To install Privacy Badger from source in Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked" and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the [`src/manifest.json`](src/manifest.json) file. Note that this only installs the extension temporarily; it will be removed when you close Firefox.


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

### Commit messages

Please review the suggestions in this excellent [guide to writing commit messages](https://chris.beams.io/posts/git-commit/).
