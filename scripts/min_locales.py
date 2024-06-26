#!/usr/bin/env python3

import json

from collections import OrderedDict
from glob import glob


def minify(locale):
    # read in locale, preserving existing ordering
    with open(locale, 'r', encoding="utf-8") as f:
        data = json.load(f, object_pairs_hook=OrderedDict)

    # blank out descriptions
    for key in data:
        if "description" in data[key]:
            data[key]["description"] = ""

    with open(locale, 'w', encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


if __name__ == '__main__':
    for locale in glob("src/_locales/*/*.json"):
        minify(locale)
