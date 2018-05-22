Privacy Badger [![Build Status](https://travis-ci.org/EFForg/privacybadger.svg?branch=master)](https://travis-ci.org/EFForg/privacybadger)
===================
Privacy Badger is a browser extension that automatically learns to block invisible trackers. Instead of keeping lists of what to block, Privacy Badger learns by watching which domains appear to be tracking you as you browse the Web.

Privacy Badger sends the [Do Not Track signal](https://www.eff.org/issues/do-not-track) with your browsing. If trackers ignore your wishes, your Badger will learn to block them. Privacy Badger starts blocking once it sees the same tracker on three different websites.

Besides automatic tracker blocking, Privacy Badger removes outgoing link click tracking on [Facebook](https://www.eff.org/deeplinks/2018/05/privacy-badger-rolls-out-new-ways-fight-facebook-tracking) and [Twitter](https://www.eff.org/deeplinks/2017/08/privacy-badger-makes-twitter-little-less-creepy), with more privacy protections on the way.

To learn more, see [the FAQ on Privacy Badger's homepage](https://www.eff.org/privacybadger#badger-faq-header).


## Contributing

We're glad you want to help! Please see [our contributor guide](/CONTRIBUTING.md).

To install Privacy Badger from source in Chrome, visit `chrome://extensions`, enable "Developer mode", click "Load unpacked extension..." and select the [`src`](src/) subdirectory inside your copy of the Privacy Badger source code.

In Firefox, visit `about:debugging`, click "Load Temporary Add-on" and select the [`src/manifest.json`](src/manifest.json) file. Note that this only installs the extension temporarily; it will be removed when you close Firefox.


## Getting in touch

Besides using [our issue tracker](https://github.com/EFForg/privacybadger/issues) here, you could join the [Privacy Badger mailing list](https://lists.eff.org/mailman/listinfo/privacybadger).

We also hold public meetings using [Jitsi audio conferencing](https://meet.jit.si/PoliteBadgersSingEuphoricly):
- Mondays at 10:30 AM PST
- Thursdays at 11:30 AM PST


## License

Privacy Badger is licensed under the GPLv3. See [LICENSE](/LICENSE) for more details.

Privacy Badger is a project of the [Electronic Frontier Foundation](https://www.eff.org).
