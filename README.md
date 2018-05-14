Privacy Badger [![Build Status](https://travis-ci.org/EFForg/privacybadger.svg?branch=master)](https://travis-ci.org/EFForg/privacybadger)
===================
Privacy Badger blocks spying ads and invisible trackers. It's there to ensure that companies can't track your browsing without your consent.

This extension is designed to automatically protect your privacy from third party trackers that load invisibly when you browse the web. We send the Do Not Track header with each request, and our extension evaluates the likelihood that you are still being tracked. If the algorithm deems the likelihood is too high, we automatically block your browser from responding to the domain. Just because a domain has been flagged by Privacy Badger's algorithm, doesn't mean that that domain is tracking you, just that it could be. 

Our extension has three states. Red means Privacy Badger believes this third-party domain is a tracker, and has blocked it. Yellow means the domain is believed to be both a tracker and necessary for the functioning of the page, so Privacy Badger is allowing it but blocking its cookies to prevent it from uniquely identifying you. Green means that Privacy Badger believes this is not tracker. You can click on the Privacy Badger icon in your browser's toolbar if you wish to override the automatic blocking settings. Or, you can browse in peace as Privacy Badger starts finding and eating up web trackers one by one.

Nothing can stop the Privacy Badger from eating cookies when it's hungry!

Privacy Badger is a project of the Electronic Frontier Foundation.


## Get in touch

If you have questions, comments, ideas, proposals, or just want to chat about privacy, then please get in touch:

* We have a [mailing list](https://lists.eff.org/mailman/listinfo/privacybadger).
* We hold public office hours on [Jitsi video chat](https://meet.jit.si/PoliteBadgersSingEuphoricly):
	- Mondays at 10:30 AM PST
	- Thursdays at 11:30 AM PST


## Developing

We're glad you want to help! We have a **[handy guide for
contributors](/CONTRIBUTING.md)**. It can hopefully point you to helpful
resources if you have any questions (please let us know if it doesn't). To get
started with most things, you'll need to [install Privacy Badger from
source](#install-from-source) so we'll start there.


### Install from source

To hack on privacy badger you need to install it from source.

In Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked extension..." and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the `src/manifest.json` file. Note that this only installs the extension temporarily, it is removed when you close Firefox.

To test your installation, try running the unit tests by following [these instructions](/doc/tests.md#unit-tests).


### Testing

We have a few different types of tests:

* We use [unit tests](/doc/tests.md#unit-tests) for confirming that smaller pieces of code behave as expected.
* [Functional tests](/doc/tests.md#functional-tests) test the UI and that things integrate together properly.
* [Travis CI](/doc/tests.md#travis-ci) runs all these automatically for every pull request on both Chrome and Firefox.


## License
Privacy Badger is licensed under the GPLv3. See LICENSE for more details
