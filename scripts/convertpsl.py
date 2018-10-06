#!/usr/bin/env python

# script based on
# https://github.com/adblockplus/buildtools/blob/d090e00610a58cebc78478ae33e896e6b949fc12/publicSuffixListUpdater.py

from __future__ import print_function

import json
import sys

def convert(psl_text):
    suffixes = {}

    for line in psl_text:
        line = line.rstrip()
        if line.startswith('//') or '.' not in line:
            continue
        if line.startswith('*.'):
            suffixes[line[2:]] = 2
        elif line.startswith('!'):
            suffixes[line[1:]] = 0
        else:
            suffixes[line] = 1

    return suffixes


if __name__ == '__main__':
    with open(sys.argv[1], 'r+') as f:
        psl = convert(f)
        f.seek(0)
        text = 'window.publicSuffixes = %s;' % (
            json.dumps(psl, sort_keys=True, indent=2, separators=(',', ': '))
        )
        print(text, file=f)
        f.truncate()
