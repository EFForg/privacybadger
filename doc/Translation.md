# Translating Privacy Badger

We need your help in translating Privacy Badger!

:warning: Please note that not all languages are [supported by Chrome](https://developer.chrome.com/docs/extensions/reference/i18n/#supported-locales).

You can contribute directly on GitHub, or you could [join us on Transifex](https://explore.transifex.com/eff/privacy-badger/), a localization platform. (We may [migrate from Transifex to potentially Weblate](https://github.com/EFForg/privacybadger/issues/2591#issuecomment-616816017) in the future.)

See below for miscellaneous notes as well as instructions for contributing via GitHub.

## Notes

- When translating you should always use
the [source (American English) locale](../src/_locales/en_US/messages.json)
as the reference. You can use existing translations from other languages
to help you in case of doubt, but you should always consider the English
version as the correct one.


- While working on a Privacy Badger pull request, you might need to add one or
more localized strings. You only need to add new strings to the source
(`en_US`) locale. There is no need to manually add untranslated copies of new
messages to all other locales. This will be taken care of later by a Privacy
Badger maintainer.

- To learn about outstanding translations-related issues, and to
see how translations have been handled in the past, take a look
at issues and pull requests marked with
the [translations label](https://github.com/EFForg/privacybadger/issues?utf8=%E2%9C%93&q=label%3Atranslations%20).


## Working with translations on GitHub

Translations on GitHub are done with JSON files.
Each language has its own folder inside
[`src/_locales/`](https://github.com/EFForg/privacybadger/tree/master/src/_locales)
(e.g. 'es' for Spanish, 'ru' for Russian, etc.).
Inside each of these folders is a JSON file that contains the translated
strings for that language. Each entry in the JSON file follows this structure:

    "string_identifier": {
        "message": "String text"
        "description": "Some useful info"
    }

The translated string is the `"String text"` part. You should **NOT** change
any other part of the entry.

The `"Some useful info"` part sometimes contains useful information (in
English) about the string. Usually it provides the context of the string: what
it is ("a section heading") and where it can be found in the UI ("on the new
user intro page"). You should not translate it.

To contribute on GitHub, first check the status of your local language
translation: if you don't see a folder with your
[local language code](https://developer.chrome.com/docs/webstore/i18n/?csw=1#choosing-locales-to-support),
the translation for that language is missing. In this case you should follow
the instructions below to set up the JSON file for your language. If the
translation for your language is already there, you can contribute by checking
its accuracy and by correcting any errors you find (see below for
instructions).

#### Add a new language

To add a new language on GitHub, follow these steps:

1. Fork this repository
2. Inside your fork, create a folder in `src/_locales/` and name it
with your [local language code](https://developer.chrome.com/docs/webstore/i18n/?csw=1#choosing-locales-to-support)
3. Copy the `src/_locales/en_US/messages.json` file to the folder you created
4. Start translating each message to your language by replacing the
English strings with the translated ones
5. When you have completed the translation, [open a pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/). Here you can find
an example translation pull request: [#1270](https://github.com/EFForg/privacybadger/pull/1270).

#### Correct an existing translation

To correct errors in an existing translation:

1. Fork this repository
2. Open your local language JSON file and apply the changes
3. When you have completed your work, [open a pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/).
Here you can find an example translation pull request:
[#1270](https://github.com/EFForg/privacybadger/pull/1270).


## Testing your translations

To see your (in-progress) translations in the actual Privacy Badger UI, you should first [load Privacy Badger from source code](/doc/develop.md#install-from-source).

A quick/hacky way to change Privacy Badger's locale is to temporarily copy the locale you want to use to your default (OS) locale's folder in `src/_locales/` and reload Privacy Badger.

The proper way would be to launch the browser in your desired locale.

Firefox requires [downloading a language pack](https://addons.mozilla.org/en-US/firefox/language-tools/) and [switching to it in settings](https://support.mozilla.org/en-US/kb/use-firefox-another-language). See also: MDN docs for [testing localized extensions in Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization#testing_out_your_extension).

For Chrome, see Chrome developer docs for [setting the browser's locale](https://developer.chrome.com/docs/extensions/reference/api/i18n#how-to-set-browsers-locale). On Linux, it's as simple as launching Chrome from the command line with `LANGUAGE=fr` (for example) prepended to the command.
