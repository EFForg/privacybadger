# Travis CI

Every pull request runs the full suite of functional tests, and unit tests on Travis CI. We test on Chrome stable and beta, on Firefox we test ESR, latest, and beta. See our `[.travis.yml](/.travis.yml)` for the configuration, as well as [`scripts/setup_travis.sh`](scripts/setup_travis.sh) and
[`scripts/run_travis.sh`](scripts/run_travis.sh).

We also run [ESLint](https://eslint.org) on Travis to test for JavaScript style and errors. See `.eslintrc.yml` and `.eslintignore` for specifics.

# Unit tests

To run the unit tests, click on the badger icon next to the URL bar to open the popup.
Then in the popup, click on the gear icon (⚙) to open the options page.
Your browser should navigate to an internal URL that starts with `chrome-extension://` or `moz-extension://` and ends with `/skin/options.html`.
Replace `/skin/options.html` with `/tests/index.html` and hit enter.
This will open the unit tests and run them.

Unittests are located in `privacybadger/src/tests/tests`. The unit test dependencies are in `privacybadger/src/tests/lib`. Please add unittests whenever possible.

# Functional tests

To run the Selenium functional tests,
you'll need to install `chromedriver` ([link](https://github.com/EFForg/privacybadger/blob/0760b82730fe06d229a9866b3c5e270e48f0fd18/scripts/setup_travis.sh#L3-L7)) for Chrome
or `geckodriver` ([link](https://github.com/EFForg/privacybadger/blob/0760b82730fe06d229a9866b3c5e270e48f0fd18/scripts/setup_travis.sh#L3-L7)) for Firefox.
You also need some python packages which can be installed by running:
```bash
$ pip install -r tests/requirements.txt
```

Now you should be able to run the Selenium tests!
Try them out by running the code below.
This should take several minutes.
```bash
$ BROWSER=chrome pytest -v
```

The `BROWSER` environment variable must be set. It must be one of:
* `BROWSER=/path/to/a/browser`
* the name of a browser executable that can be found like `which $BROWSER`
* or simply `BROWSER=chrome` or `BROWSER=firefox` if you have them installed

## Examples

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

Refer to the our Travis CI scripts for more information:
[`scripts/setup_travis.sh`](scripts/setup_travis.sh) and
[`scripts/run_travis.sh`](scripts/run_travis.sh).

