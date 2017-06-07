Privacy Badger [![Build Status](https://travis-ci.org/EFForg/privacybadger.svg?branch=master)](https://travis-ci.org/EFForg/privacybadger)
===================
Privacy Badger blocks spying ads and invisible trackers. It's there to ensure that companies can't track your browsing without your consent.

This extension is designed to automatically protect your privacy from third party trackers that load invisibly when you browse the web. We send the Do Not Track header with each request, and our extension evaluates the likelihood that you are still being tracked. If the algorithm deems the likelihood is too high, we automatically block your browser from responding to the domain. Just because a domain has been flagged by Privacy Badger's algorithm, doesn't mean that that domain is tracking you, just that it could be. 

Our extension has three states. Red means Privacy Badger believes this third-party domain is a tracker, and has blocked it. Yellow means the domain is believed to be both a tracker and necessary for the functioning of the page, so Privacy Badger is allowing it but blocking its cookies to prevent it from uniquely identifying you. Green means that Privacy Badger believes this is not tracker. You can click on the Privacy Badger icon in your browser's toolbar if you wish to override the automatic blocking settings. Or, you can browse in peace as Privacy Badger starts finding and eating up web trackers one by one.

Nothing can stop the Privacy Badger from eating cookies when it's hungry!

Privacy Badger is a project of the Electronic Frontier Foundation.

## Developing
For an easy build, simply enable developer mode in chrome://extensions, hit
the "load unpacked extension" button and load up this directory.

Within the command line, install the dependencies.

```bash
$ npm install
```

### Get in touch

If you want to chat about Privacy Badger please join us in the [`#privacybadger`](https://webchat.freenode.net/?channels=privacybadger) IRC channel on freenode.

We have public hang outs for discussing development, bugs, feature, trackers etc. every Monday and Thursday at 11:30am PST on https://meet.jit.si/PoliteBadgersSingEuphoricly

We also have a mailing list at https://lists.eff.org/mailman/listinfo/privacybadger

### Testing

This project is using the [QUnit](http://qunitjs.com/), [py.test](http://pytest.org/), [Selenium](http://www.seleniumhq.org/) test frameworks
along with [Travis CI](https://travis-ci.org/) for continuous integration.

To run unit tests, find your extension's ID (look for it on `chrome://extensions/`) and
visit `chrome-extension://YOUR_EXTENSION_ID/tests/index.html`, replacing
`YOUR_EXTENSION_ID` with your 32 character ID.

To run functional tests powered by Selenium, you need to have `chromedriver`, `xvfb` and `python-virtualenv` installed. Also `geckodriver` to run functional tests in Firefox. See [scripts/setup_travis.sh](scripts/setup_travis.sh) and [tests/run_selenium_tests.sh](tests/run_selenium_tests.sh).

## License
Privacy Badger is licensed under the GPLv3. See LICENSE for more details
