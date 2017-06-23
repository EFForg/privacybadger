# Documentation

This set of documents contain information on how to contribute to the project, report issues, tips and guidelines.

* [Community Guidelines]()
* [Contribution Guidelines](CONTRIBUTION-GUIDELINES.md)
* [Design and Roadmap](DESIGN-AND-ROADMAP.md)
* [Implementation]()


## Topics
* [Reporting issues](#reporting-issues)
* [How to fix broken sites](#how-to-fix-broken-sites)
* [Design and cleanup proposals](#design-and-cleanup-proposals)
*

## Reporting Issues
One way to contribute to Privacy Badger is by reporting issues you find.

Before you submit an issue make sure it hasn't been reported already in [the issues section.](https://github.com/EFForg/privacybadger/issues) If you find an issue and have ways to reproduce it or have additional information add a comment.

If you could not find the issue try to collect as much information and use the [Issue Template](issue_template.md) as a guide.

## How to fix broken sites
Unfortunately, while working to protect your privacy, Privacy Badger can end up breaking website functionality. This document is about the process of classifying and resolving these breakages.

Here are the [open "broken site" and "good-volunteer-task"-labeled issues](https://github.com/EFForg/privacybadger/issues?utf8=%E2%9C%93&q=is%3Aissue%20is%3Aopen%20label%3A%22broken%20site%22%20label%3A%22good%20volunteer%20task%22).

The first thing to do is to confirm that Privacy Badger blocks (or will eventually learn to block) the domain, and that blocking the domain does indeed break the site.

Once the issue is confirmed, you should try to find the most appropriate way to resolve it. Privacy Badger has several existing ways of resolving site issues:

- Multi-domain first parties
- Script surrogates
- Widget replacement
- EFF's Do Not Track policy
- Yellowlisting

The question to ask is, which way addresses the issue most specifically, resolving the breakage while increasing privacy exposure by the smallest amount? Let's look at some common kinds of breakages.

### Domains that are part of the site but don't look like it

Does the blocked domain actually belong to the site, but Privacy Badger doesn't know that and so treats the domain as an external tracker? Sounds like a job for [multi-domain first parties](https://github.com/EFForg/privacybadger/issues/781).


### JavaScript errors

Does blocking the domain block a JavaScript analytics library that the site tries to use and fails, breaking site navigation? This could be resolved by [script surrogates](https://github.com/EFForg/privacybadger/issues/400).


### External services

Is the missing comments section powered by a commenting service that Privacy Badger learned to block? Perhaps a new [widget replacement](https://github.com/EFForg/privacybadger/pull/196) should be added.

We should also ask the service to to adopt the [EFF Do Not Track policy](https://www.eff.org/dnt-policy), which is a way for privacy-conscious companies to receive recognition for their good practices. If their service can and will abide by the policy's requirements, posting the policy on the service's domains will tell Privacy Badger to allow loading of resources from those domains.


### External domains too complex to surrogate or replace with placeholders

If nothing else seems to fit, adding the affected domain to the "[yellowlist](/doc/yellowlist-criteria.md)" will make Privacy Badger set the domain to "yellow" (cookie-blocked) instead of "red" (blocked) after seeing it track on three or more sites.


## Design and cleanup proposals

## Contribution Guidelines
* [Contributing Guide](CONTRIBUTING.md)

## Setting up a development environment
### Load the extension from source code
In Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked extension..." and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the `src` subdirectory.

### Testing

This project uses the [QUnit](http://qunitjs.com/), [py.test](http://pytest.org/), [Selenium](http://www.seleniumhq.org/) test frameworks
along with [Travis CI](https://travis-ci.org/) for continuous integration.

#### Unit Tests
To run unit tests, find your extension's ID (look for it on `chrome://extensions/`) and
visit `chrome-extension://YOUR_EXTENSION_ID/tests/index.html`, replacing
`YOUR_EXTENSION_ID` with your 32 character ID.

#### Selenium
* The current instructions for selenium tests are broken (add ff instructons after #1168 is in)

To run functional tests powered by Selenium, you need to have `chromedriver`, `xvfb` and `python-virtualenv` installed. Also `geckodriver` to run functional tests in Firefox. See [scripts/setup_travis.sh](scripts/setup_travis.sh) and [tests/run_selenium_tests.sh](tests/run_selenium_tests.sh).

#### How to install in Firefox with web-ext and run qunit tests


### Debugging
#### How to address "site-bug" issues, different kind of issues



#### On Firefox
1. Visit `about:debugging`
2. Enable add-on debugging.
3. Click Debug next to Privacy Badger
4. Select the console tab and paste the following in the ">>" prompt: `badger.storage.snitch_map.getItem("THE_DOMAIN_IN_QUESTION")`

#### On Chrome
1. Click on Privacy Badger.
2. Right-click on the bubble with the details.
3. Select "Inspect"
4. Select the console tab and paste the following in the ">>" prompt: `badger.storage.snitch_map.getItem("THE_DOMAIN_IN_QUESTION")`
