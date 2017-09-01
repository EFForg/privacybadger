# Translation

We need your help to translate Privacy Badger to every possible language.
If you think you can help translating to your local language, here you
will find instructions to help you in the process.

At the moment we handle the translations of Privacy Badger with two different
platforms: Transifex and GitHub. Feel free to use the tool you prefer.

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
its accuracy and by correcting any error you find.

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
a great example of a pull request for a translation: #1270)
