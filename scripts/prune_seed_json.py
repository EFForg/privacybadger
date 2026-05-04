#!/usr/bin/env python3

import json
import subprocess
import sys

from collections import OrderedDict


def prune_fp_scripts(data):
    export_js = """
// shim just enough for constants.js to load
globalThis.chrome = { runtime: { getURL: ()=>{} } };
const { default: constants } = await import('./src/js/constants.js');
process.stdout.write(JSON.stringify(Array.from(constants.FP_CDN_DOMAINS)));"""

    try:
        cmd = ["node", "--experimental-default-type=module", f'--eval={export_js}']
        fp_cdn_domains = subprocess.run(
            cmd, capture_output=True, check=True, text=True).stdout.strip()
    except subprocess.CalledProcessError as ex:
        print(ex.stderr, file=sys.stderr)
        raise ex

    new_fp_scripts = {}
    for domain in data['fp_scripts']:
        if domain in fp_cdn_domains:
            new_fp_scripts[domain] = data['fp_scripts'][domain]

    data['fp_scripts'] = new_fp_scripts

    return data


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

        seed_data = prune_fp_scripts(seed_data)

        # write the data back out
        seed_file.seek(0)
        seed_file.truncate(0)
        # this should match how data gets written out by Badger Sett
        json.dump(seed_data, seed_file, indent=2, sort_keys=True, separators=(',', ': '))
