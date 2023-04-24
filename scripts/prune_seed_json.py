#!/usr/bin/env python3

import json
import sys

from collections import OrderedDict


def prune_action_map(data):
    new_action_map = {}

    for domain in data['action_map']:
        keep = False
        action_entry = data['action_map'][domain]

        # keep base domains,
        # and DNT-compliant or cookieblocked subdomains
        if domain in data['snitch_map']:
            keep = True
        else:
            if 'dnt' in action_entry:
                keep = True
            elif action_entry['heuristicAction'] == "cookieblock":
                keep = True

        if keep:
            new_action_map[domain] = action_entry

    data['action_map'] = new_action_map

    return data


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} BADGER_SEED_DATA.json")
        sys.exit(1)

    with open(sys.argv[1], 'r+', encoding='utf-8') as seed_file:
        # read in seed data, preserving ordering
        seed_data = json.load(seed_file, object_pairs_hook=OrderedDict)

        seed_data = prune_action_map(seed_data)

        # write the data back out
        seed_file.seek(0)
        seed_file.truncate(0)
        # this should match how data gets written out by Badger Sett
        json.dump(seed_data, seed_file, indent=2, sort_keys=True, separators=(',', ': '))
