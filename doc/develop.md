# Working with Privacy Badger's code

To make changes to Privacy Badger, you have to first load the extension from a source code checkout.


## Install from source

To install Privacy Badger from source in Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked" and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the [`src/manifest.json`](src/manifest.json) file. Note that this only installs the extension temporarily; it will be removed when you close Firefox.


## Send a pull request

Before submitting a pull request (PR), please check your changes using [ESLint](https://eslint.org), our preferred automated static analysis ("lint") tool.

### Lint your changes

First, install the exact expected version of ESLint by running `npm install` in your Privacy Badger source code checkout directory. You should then be able to produce a lint report by running `make lint` in the same directory.

You can review our set of ESLint rules in [`.eslintrc.yml`](/.eslintrc.yml). Files we want ESLint to ignore are specified in [`.eslintignore`](/.eslintignore).

### Writing good commit messages

I highly suggest reviewing the suggestions in this [excellent guide to writing commit messages](https://chris.beams.io/posts/git-commit/).
