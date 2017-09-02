#!/usr/bin/env python

# script based on
# https://github.com/adblockplus/buildtools/blob/d090e00610a58cebc78478ae33e896e6b949fc12/publicSuffixListUpdater.py

import json
import sys


def convert(psl_text):
    suffixes = []

    for line in psl_text:
        line = line.rstrip()
        if line.startswith('//') or '.' not in line:
            continue
        if line.startswith('*.'):
            suffixes.append([line[2:], ])
        elif line.startswith('!'):
            suffixes.append([line[1:], 0])
        else:
            suffixes.append([line, 1])

    return sorted(suffixes, key=lambda x: x[0])


if __name__ == '__main__':
    with open(sys.argv[1], 'r+') as f:
        psl = convert(f)
        f.seek(0)
        f.write('const publicSuffixes = new Map(\n%s\n);' % (
            '],\n'.join(json.dumps(psl).split('],'))
        ))
        f.truncate()
