# Working with Privacy Badger's tests

There are two types of tests:

* [Unit tests](/doc/tests.md#unit-tests) for exercising isolated units of code
* [Functional tests](/doc/tests.md#functional-tests) for verifying high-level extension functionality

[GitHub Actions](/doc/tests.md#github-actions-ci) runs unit and functional tests on every pull request on Chrome, Firefox and Edge.

## GitHub Actions CI

Every pull request runs the full suite of tests on GitHub Actions. See [`test.yml`](/.github/workflows/test.yml) for the GitHub Actions configuration.

We use [ESLint](https://eslint.org) to flag potential JavaScript errors and style issues. Please see our [developer guide](/doc/develop.md#lint-your-changes) for setup instructions.

## Unit tests

We use [QUnit](https://qunitjs.com/) for unit tests.
Unit tests are defined in [`/src/tests/tests`](/src/tests/tests). Unit test dependencies live in [`/src/tests/lib`](/src/tests/lib).

To run unit tests, first [load Privacy Badger from source code](/doc/develop.md#install-from-source) (as we don't ship unit tests with published versions).
Once you loaded Badger from source, click on its button in your browser toolbar to open Badger's popup.
Then in the popup, click on the gear icon (⚙) to open the options page.
Your browser should navigate to an internal URL that starts with `chrome-extension://` or `moz-extension://` and ends with `/skin/options.html`.
Replace `/skin/options.html` with `/tests/index.html` and hit <kbd>Enter</kbd>.
This will open the unit test suite and run the tests.

### Writing unit tests

When writing unit tests, try to scope each test to the function or method in question, then each individual assertion within that test addressing a core piece of functionality or expectation of that test. Consider testing expected input, potential breaking points, and expected outputs. It's easy to get caught going down rabbit holes testing unlikely scenarios, so consider which edge cases are most important to consider, and which are more likely to occur.

Do verify that removing or mutating the code being tested produces failed assertions.

## Functional tests

Our [functional tests](/tests/selenium/) are written in Python and driven by [Selenium](https://selenium-python.readthedocs.io/) and [pytest](https://docs.pytest.org/en/latest/).

- To run them in Chrome, you need to [install `chromedriver`](http://chromedriver.chromium.org/getting-started)
- For Firefox, you need to [install `geckodriver`](/scripts/geckodriver.sh)
- For Microsoft Edge, [install Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)

You also need to [install the Python packages](https://snarky.ca/a-quick-and-dirty-guide-on-how-to-install-packages-for-python/) specified in [`/tests/requirements.txt`](/tests/requirements.txt).

You should now be able to run the Selenium tests. Try them out by running
the code below. This should take several minutes.
```bash
$ BROWSER=chrome pytest -v tests/
```

macOS users may need to provide the full path to the browser application folder. For example, to run tests on macOS:
```bash
$ BROWSER=/Applications/Firefox.app/Contents/MacOS/firefox-bin pytest -v tests/
# or
$ BROWSER=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome pytest -v tests/
```


### Invocation examples

Note that to use a debugger like `pdb` or `ipdb` you must pass the `-s` (`--capture=no`) flag to pytest.
```bash
# run qunit_test.py, with Firefox, with verbose output (-v)
$ BROWSER=/usr/bin/firefox pytest -v tests/selenium/qunit_test.py tests/

# run a specific test on a specific class in a specific module with Chrome Beta
$ BROWSER=google-chrome-beta pytest tests/selenium/supercookie_test.py::SupercookieTest::test_should_detect_ls_of_third_party_frame

# run any tests whose name (including the module and class) matches the string cookie_test
# this is often useful as a less verbose way to run a single test
$ BROWSER=firefox pytest -k cookie_test tests/
```

More pytest invocations can be found [here](https://docs.pytest.org/en/latest/usage.html).

If you are on Linux, you can also run the tests headlessly (without displaying a GUI).
Install `Xvfb` with your system package manager, then set the `ENABLE_XVFB=1` environment variable:

```bash
$ BROWSER=firefox ENABLE_XVFB=1 pytest -s -v -k PopupTest tests/
```

### Writing functional tests

Test methods that you want to be discovered and run by `pytest` must be prefixed with the keyword `test`. For example: `test_pixel_tracking_detection`. A similar rule applies to naming any new test class files that you want to be detected by the testing suite: the `test` keyword must be appended to the end of the title. For example: `pixel_test.py`.

When testing Badger's tracker detection/learning, you should first clear the pre-trained/seed tracker data with `self.clear_tracker_data()`. Clearing seed data ensures that the tracking domain was discovered just now and not from seed data.

You should also set up your tracking detection test in a way where your test fixture has a "no tracking" mode that you visit first and assert that no tracking was detected. This is to ensure that when we detect the tracking being tested we didn't actually detect some other kind of tracking instead.

Just as with unit tests, please verify that removing or mutating the code being tested produces failed assertions.
