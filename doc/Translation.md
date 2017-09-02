# Translation

We need your help to translate Privacy Badger to every possible language.
If you think you can help translating to your local language, here you
will find instructions to help you in the process.

At the moment we handle the translations of Privacy Badger with two different
platforms: Transifex and GitHub. Feel free to use the tool you prefer.

When translating you should always use the original (english) version as a 
reference. You can also use other languages translations to help you in case
of doubt but you should always consider the english version as the correct one.

## GitHub

Translations on GitHub are done with JSON files.
Each language has its own folder inside src/_locales (e.g. 'es' for Spanish,
'ru' for Russian, etc.).
Inside each of these folders there is a JSON file which contains the translated
strings for that language. Each entry on the JSON file follows this structure:

    "string_identifier": {
        "message": "String text"
    }
    
The translated string is the `"String text"` part and you should **NOT** change
any other part of the entry.

To contribute to the Privacy Badger translation through GitHub, first check the
status of your local language translation: if you can't see a folder with your 
local language code, the translation for that language is missing. In this case
you should follow the instructions below to setup the JSON file for your language.
If the translation for your language is already there you can contribute by checking
its accuracy and by correcting any error you find (see below for instructions).

#### Add a new language

To add a new language to GitHub, follow these steps:

1. Fork this repository;
2. Inside your fork, create a folder in src/_locales and name it
with your local language code;
3. Copy the en_US/messages.json files inside the folder you created;
4. Start translating each message to your language by replacing the
english strings with the translated ones;
5. When you have completed the translation open a pull request from
your fork to the EFF/privacybadger repository (here you can find
a great example of a pull request for a translation: #1270).

#### Correct an existing translation

To correct some error in an existing translation:

1. Fork this repository;
2. Open your local language json file and apply the changes;
3. When you have completed your work open a pull request from
your fork to the EFF/privacybadger repository (here you can find
a great example of a pull request for a translation: #1270).

## Transifex

To contribute to the translation through Transifex you should have
an account on the website. You can create a free account from the 
[Transifex homepage](https://www.transifex.com/).

To translate Privacy Badger with Transifex, go to this page: [Privacy Badger](https://www.transifex.com/eff/privacy-badger/dashboard/), login to your account and click on the Translate button.
The Transifex platform is quite intuitive to use. For any question about
Transifex refer to its [documentation](https://docs.transifex.com/).
Before starting to Translate through Transifex, send a message to
ghostwords that will check if Transifex and GitHub translations are correctly
synced (to send him a message, go to [his profile](https://www.transifex.com/user/profile/ghostwords/)
and click on "Send message"). In this way you will avoid to translate
something that has already been translated or that is currently being
translated. Also, send him a message when you have finished your work
so that he will upload your translation to GitHub.

In case of doubts when translating on Transifex you can leave comments
under the strings entries.

## Other information

For other inoformation you can take a look at the issues and pull
requests regarding the translation (marked with the [translations](https://github.com/EFForg/privacybadger/issues?utf8=%E2%9C%93&q=label%3Atranslations%20) label).
