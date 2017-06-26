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

If you want to chat about Privacy Badger, please join us in the [`#privacybadger`](https://webchat.oftc.net/?channels=privacybadger&uio=d4) IRC channel on OFTC.

We have public meetings for discussing development, bugs, feature, trackers, etc. every Monday and Thursday at 11:30am PST on [Jitsi video chat](https://meet.jit.si/PoliteBadgersSingEuphoricly).

We also have a [mailing list](https://lists.eff.org/mailman/listinfo/privacybadger).

### Testing

This project uses the [QUnit](http://qunitjs.com/), [pytest](http://pytest.org/), [Selenium](http://www.seleniumhq.org/) test frameworks
along with [Travis CI](https://travis-ci.org/) for continuous integration.

#### Unit tests

To run the unit tests, click on the badger icon next to the URL bar to open the popup.
Then in the popup, click on the gear icon (⚙) to open the options page.
Your browser should navigate to an internal URL that starts with `chrome-extension://` or `moz-extension://` and ends with `/skin/options.html`.
Replace `/skin/options.html` with `/tests/index.html` and hit enter.
This will open the unit tests and run them.

#### Functional tests

To run the Selenium functional tests,
you'll need to install `chromedriver` ([link](https://github.com/EFForg/privacybadger/blob/0760b82730fe06d229a9866b3c5e270e48f0fd18/scripts/setup_travis.sh#L3-L7)) for Chrome
or `geckodriver` ([link](https://github.com/EFForg/privacybadger/blob/0760b82730fe06d229a9866b3c5e270e48f0fd18/scripts/setup_travis.sh#L3-L7)) for Firefox.
You also need some python packages which can be installed by running:
```bash
$ pip install -r tests/requirements.txt
```

Now you should be able to run the selenium tests!
Try them out by running the code below.
This should take several minutes.
```bash
$ BROWSER=chrome pytest -v
```

The `BROWSER` environment variable must be set. It must be one of:
* `BROWSER=/path/to/a/browser`
* the name of a browser executable that can be found like `which $BROWSER`
* or simply `BROWSER=chrome` or `BROWSER=firefox` if you have them installed

##### Examples

Note that to use a debugger like `pdb` or `ipdb` you must pass the `-s` (`--capture=no`) flag to pytest.
```bash
# run qunit_test.py, with firefox, with verbose output (-v)
$ BROWSER=/usr/bin/firefox pytest -v tests/selenium/qunit_test.py

# run a specific test on a specific class in a specific module, on google-chrome-stable
$ BROWSER=google-chrome-stable pytest super_cookie_test.py::SuperCookieTest::test_should_detect_ls_of_third_party_frame

# run any tests whose name (including the module and class) matches the string cookie_test
# this is often useful as a less verbose way to run a single test
$ BROWSER=firefox pytest -k cookie_test
```

More pytest invocations can be found [here](https://docs.pytest.org/en/latest/usage.html) (these are very useful).

If you are on Linux, you can also run the tests headlessly (without displaying a GUI).
Install `Xvfb` with your system package manager, then set the `ENABLE_XVFB=1` environment variable.
Like this:

```bash
$ BROWSER=~/Downloads/firefox/firefox ENABLE_XVFB=1 pytest -s -v -k pbtest_org
```

Refer to the our Travis-CI scripts for more information:
[`scripts/setup_travis.sh`](scripts/setup_travis.sh) and
[`scripts/run_travis.sh`](scripts/run_travis.sh).

## License
Privacy Badger is licensed under the GPLv3. See LICENSE for more details
