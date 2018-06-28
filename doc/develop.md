# Working with Privacy Badger's code

To make changes to Privacy Badger, you have to first load the extension from a source code checkout.

## Install from source

To install Privacy Badger from source in Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked extension..." and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the [`src/manifest.json`](src/manifest.json) file. Note that this only installs the extension temporarily; it will be removed when you close Firefox.
