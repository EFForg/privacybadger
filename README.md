Privacy Badger [![Build Status](https://travis-ci.org/EFForg/privacybadger.svg?branch=master)](https://travis-ci.org/EFForg/privacybadger)
===================
Privacy Badger blocks spying ads and invisible trackers. It's there to ensure that companies can't track your browsing without your consent.

This extension is designed to automatically protect your privacy from third party trackers that load invisibly when you browse the web. We send the Do Not Track header with each request, and our extension evaluates the likelihood that you are still being tracked. If the algorithm deems the likelihood is too high, we automatically block your browser from responding to the domain. Just because a domain has been flagged by Privacy Badger's algorithm, doesn't mean that that domain is tracking you, just that it could be. 

Our extension has three states. Red means Privacy Badger believes this third-party domain is a tracker, and has blocked it. Yellow means the domain is believed to be both a tracker and necessary for the functioning of the page, so Privacy Badger is allowing it but blocking its cookies to prevent it from uniquely identifying you. Green means that Privacy Badger believes this is not tracker. You can click on the Privacy Badger icon in your browser's toolbar if you wish to override the automatic blocking settings. Or, you can browse in peace as Privacy Badger starts finding and eating up web trackers one by one.

Nothing can stop the Privacy Badger from eating cookies when it's hungry!

Privacy Badger is a project of the Electronic Frontier Foundation.

## Developing

### Load the extension from source code

In Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked extension..." and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the `src` subdirectory.


### Get in touch

If you want to chat about Privacy Badger, please join us in the [`#privacybadger`](https://webchat.freenode.net/?channels=privacybadger) IRC channel on freenode.

We have public meetings for discussing development, bugs, feature, trackers, etc. every Monday and Thursday at 11:30am PST on [Jitsi video chat](https://meet.jit.si/PoliteBadgersSingEuphoricly).

We also have a [mailing list](https://lists.eff.org/mailman/listinfo/privacybadger).

### Testing

This project uses the [QUnit](http://qunitjs.com/), [py.test](http://pytest.org/), [Selenium](http://www.seleniumhq.org/) test frameworks
along with [Travis CI](https://travis-ci.org/) for continuous integration.

To run unit tests on Chrome find your extension's ID look for it on
`chrome://extensions/`) and visit
`chrome-extension://YOUR_EXTENSION_ID/tests/index.html`, replacing
`YOUR_EXTENSION_ID` with your 32 character ID. For Firefox you can find your
extensions's "UUID" on `about:debugging`, then visit
`moz_extension://YOUR_EXTENSION_UUID/tests/index.html`.

To run the Selenium functional tests, you'll need to install `chromedriver` for
Chrome or `geckodriver` for Firefox. Optionally you can also install `xvfb` to
run the tests headlessly. You also need some python packages which can be installed by running:
```bash
$ pip install -r tests/requirements.txt
```

Before you need to set two environment variables:
```bash
$ export CRX_PATH=path/to/the/extension.crx
$ export BROWSER_PATH=path/to/the/browser/binary
```

Then the selenium tests can be run with:
```bash
$ py.test path/to/a/test.py
```

Refer to the our Travis-CI scripts for more information:
[`scripts/setup_travis.sh`](scripts/setup_travis.sh) and
[`tests/run_selenium_tests.sh`](tests/run_selenium_tests.sh).

## License
Privacy Badger is licensed under the GPLv3. See LICENSE for more details
