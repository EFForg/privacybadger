#!/usr/bin/env python3

import json

from collections import OrderedDict
from glob import glob

SOURCE_LOCALE = 'src/_locales/en_US/messages.json'


def fix_locale(locale, placeholder_keys):
    # read in locale, preserving existing ordering
    with open(locale, 'r') as f:
        data = json.load(f, object_pairs_hook=OrderedDict)

    # restore missing placeholders
    for key in placeholder_keys:
        if key in data and "placeholders" not in data[key]:
            data[key]["placeholders"] = source_data[key]["placeholders"]

    with open(locale, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


if __name__ == '__main__':
    with open(SOURCE_LOCALE, 'r') as f:
        source_data = json.load(f, object_pairs_hook=OrderedDict)

    # get keys of locale messages with placeholders
    placeholder_keys = []
    for key in source_data:
        if "placeholders" in source_data[key]:
            placeholder_keys.append(key)

    # fix all locales
    for locale in glob('src/_locales/*/*.json'):
        if locale == SOURCE_LOCALE:
            continue

        fix_locale(locale, placeholder_keys)
