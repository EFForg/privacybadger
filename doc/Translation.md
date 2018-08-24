# Translating Privacy Badger

We need your help in translating Privacy Badger to every possible language!
If you think you can help translate to your local language, here you
will find instructions to help you in this process.

At the moment we handle Privacy Badger translations with two different
platforms: Transifex and GitHub. Feel free to use the tool you prefer.

When translating you should always use the original (English) version as the
reference. You can also use existing translations from other languages to help
you in case of doubt, but you should always consider the English version as the
correct one.


## A note about adding translation strings in PRs

While working on a Privacy Badger enhancement, you might find yourself needing
to add a localized string. You only need to add new strings to the source
(`en_US`) locale. There is no need to manually add untranslated copies of new
messages to all other locales. This will happen when a Privacy Badger
maintainer syncs translations with Transifex after your pull request passes
review.


## GitHub

Translations on GitHub are done with JSON files.
Each language has its own folder inside `src/_locales` (e.g. 'es' for Spanish,
'ru' for Russian, etc.).
Inside each of these folders is a JSON file that contains the translated
strings for that language. Each entry in the JSON file follows this structure:

    "string_identifier": {
        "message": "String text"
        "description": "Some useful info"
    }

The translated string is the `"String text"` part and you should **NOT** change
any other part of the entry.

The `"Some useful info"` part sometimes contains useful information (in
English) about the string. Usually it provides the context of the string: what
it is (a button/a heading/...) and where it is located inside the UI. You
should never translate it.

To contribute on GitHub, first check the
status of your local language translation: if you don't see a folder with your
[local language code](https://developer.chrome.com/webstore/i18n?csw=1#localeTable), the translation for that language is missing. In this case
you should follow the instructions below to set up the JSON file for your language.
If the translation for your language is already there, you can contribute by checking
its accuracy and by correcting any errors you find (see below for instructions).

#### Add a new language

To add a new language on GitHub, follow these steps:

1. Fork this repository;
2. Inside your fork, create a folder in `src/_locales` and name it
with your [local language code](https://developer.chrome.com/webstore/i18n?csw=1#localeTable);
3. Copy the `src/_locales/en_US/messages.json` file to the folder you created;
4. Start translating each message to your language by replacing the
English strings with the translated ones;
5. When you have completed the translation, [open a pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/). Here you can find
an example translation pull request: [#1270](https://github.com/EFForg/privacybadger/pull/1270).

#### Correct an existing translation

To correct errors in an existing translation:

1. Fork this repository;
2. Open your local language JSON file and apply the changes;
3. When you have completed your work, [open a pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/).
Here you can find an example translation pull request:
[#1270](https://github.com/EFForg/privacybadger/pull/1270).


## Transifex

To contribute to translations through Transifex you should have
an account on the Transifex website. You can create a free account from the
[Transifex homepage](https://www.transifex.com/).

To translate Privacy Badger with Transifex, go to the
[Privacy Badger Transifex project](https://www.transifex.com/eff/privacy-badger/dashboard/),
log in to your account, and click on the Translate button.

Before starting your work, send a message to [ghostwords](https://www.transifex.com/user/profile/ghostwords/),
who will check if Transifex and GitHub translations are correctly
synced. To send him a message, go to [his profile](https://www.transifex.com/user/profile/ghostwords/)
and click on "Send message". This will help avoid translating
something that has already been translated or that is currently being
translated. Also, send ghostwords a message when you have finished your work
so that he will upload your translation to GitHub.

The Transifex platform is quite intuitive to use. For any questions about
Transifex refer to its [documentation](https://docs.transifex.com/).

In case of questions or concerns with translations, you can leave comments
for individual strings in the Transifex translations editor.


## Testing your translations

To see your (in-progress) translations in the actual Privacy Badger UI, you should first [load Privacy Badger from source code](/doc/develop.md#install-from-source).

A quick/hacky way to change Privacy Badger's locale is to temporarily copy the locale you want to use to your default (OS) locale's folder in `src/_locales/` and reload Privacy Badger.

The proper way would be to launch the browser in your desired locale.

For Chrome, it might be as easy as [launching it from the command line with `LANGUAGE=fr` (for example) in front of the executable](https://stackoverflow.com/questions/24992240/start-google-chrome-with-a-specific-locale-using-a-command-line-argument).

[Firefox seems to require more effort](https://askubuntu.com/questions/63724/how-do-i-start-firefox-in-another-language-than-the-default).


## Other information

To learn about outstanding translations-related issues, and to
see how translations have been handled in the past, take a look
at issues and pull requests marked with the [translations label](https://github.com/EFForg/privacybadger/issues?utf8=%E2%9C%93&q=label%3Atranslations%20).
