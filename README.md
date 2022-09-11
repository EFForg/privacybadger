Privacy Badger [![Build Status](https://travis-ci.com/EFForg/privacybadger.svg?branch=master)](https://app.travis-ci.com/github/EFForg/privacybadger/branches)
===================
Privacy Badger is a browser extension that automatically learns to block invisible trackers. Instead of keeping lists of what to block, Privacy Badger automatically discovers trackers based on their behavior.

Privacy Badger sends the [Global Privacy Control](https://globalprivacycontrol.org/) signal to opt you out of data sharing and selling, and the [Do Not Track](https://www.eff.org/issues/do-not-track) signal to tell companies not to track you. If trackers ignore your wishes, Privacy Badger will learn to block them.

Besides automatic tracker blocking, Privacy Badger comes with privacy features like [click-to-activate replacements](https://privacybadger.org/#How-does-Privacy-Badger-handle-social-media-widgets) for potentially useful trackers (video players, comments widgets, etc.), and link cleaning on [Facebook](https://www.eff.org/deeplinks/2018/05/privacy-badger-rolls-out-new-ways-fight-facebook-tracking) and [Google](https://www.eff.org/deeplinks/2018/10/privacy-badger-now-fights-more-sneaky-google-tracking).

To learn more, see [the FAQ on Privacy Badger's homepage](https://privacybadger.org/#faq).


## Supported Features
Automatic Tracking Discovery- Privacy Badger does not curate a list of websites that track data, but manually scans each tracker and it's behavior

Manual Selection- You can select from red, yellow, or green and get a default selection from privacy badger on each tracker. Red items are fully blocked, yellow items are loaded with cookies screened and removed, and green items are not impacted

Disables third party trackers- Stops invisible or visible trackers from 3rd party apps, websites, cookies, ads, or links from gathering data

Prevents third party canvas-based fingerprinting: Detects and blocks domains that are using fingerprinting


## Supported Platforms

Add the public build of privacy badger to your browser of choice using the links below 

Google Chrome: https://chrome.google.com/webstore/detail/privacy-badger/pkehgijcmpdhfbdbbnkijodmdjhbjlgp

Firefox: https://addons.mozilla.org/firefox/downloads/latest/privacy-badger17/

Firefox for Android: https://addons.mozilla.org/android/addon/privacy-badger17/

Edge: https://microsoftedge.microsoft.com/addons/detail/mkejgcgkdlddbggjhhflekkondicpnop

Opera: https://addons.opera.com/en/extensions/details/privacy-badger


## Project Setup and Local Build Process

Go to the project page and create a new fork of the privacybadger project

After creating the fork, clone the project using the link or .zip file to get it on your local machine

After cloning the project, go to your terminal and navigate to the root directory of the project

Run the following commands
```
$ npm install //installs the project dependencies

$ npm run build //creates a build directory
```

## Building and Testing Project on Different Browsers
### Chrome:

Go to the chrome extension page: chrome://extensions/

Select developer mode in the top right corner

Select "load unpacked extensions" in the top left corner and select the project folder

Test changes in the browser


### Firefox:

Go to the debugging page: about:debugging

Select "This Firefox" from the left taskbar and find the temporary extension section

Select "load temporary add-on" and select the project folder

Test the changes in the browser


### Edge:

Go to the extensions page: edge://extensions/

Select "Manage Extensions"

On the left hand side task bar, enable developer mode

Select "Load Unpacked" and select the project folder

Test the changes in the browser


### Opera:

Go to the extensions page: opera:extensions

Enable the developer mode button

Select "Load unpacked extensions" and select the project folder

Test the changes in the browser


## Contributing

We're glad you want to help! Please see [our contributor guide](/CONTRIBUTING.md).

This project is governed by [EFF's Public Projects Code of Conduct](https://www.eff.org/pages/eppcode).


## Getting in touch

Besides using [our GitHub issue tracker](https://github.com/EFForg/privacybadger/issues), you could [send us an email](mailto:extension-devs@eff.org), or join the [Privacy Badger mailing list](https://lists.eff.org/mailman/listinfo/privacybadger).

We also hold public meetings using [Jitsi audio conferencing](https://meet.jit.si/PoliteBadgersSingEuphoricly):
- Mondays at 10:30 AM [Pacific Time](https://en.wikipedia.org/wiki/Pacific_Time_Zone)
- Thursdays at 01:00 PM Pacific Time


## License

Privacy Badger is licensed under the GPLv3. See [LICENSE](/LICENSE) for more details.

Privacy Badger is a project of the [Electronic Frontier Foundation](https://www.eff.org).
