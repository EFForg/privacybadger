#!/usr/bin/env python3

import argparse
import json

from collections import OrderedDict

def update_manifest(manifest_path, operation, key, value, json_value):
    with open(manifest_path, 'r', encoding="utf-8") as f:
        manifest_data = json.load(f, object_pairs_hook=OrderedDict)

    if operation == 'del':
        data = manifest_data
        while '.' in key: # handle nested keys ("x.y.z")
            idx, _, key = key.partition('.')
            data = data[idx]
        del data[key]

    elif operation == 'set':
        if json_value:
            try:
                value = json.loads(value)
            except json.decoder.JSONDecodeError as err:
                print("Failed to parse", value)
                raise err

        data = manifest_data
        while '.' in key: # handle nested keys ("x.y.z")
            idx, _, key = key.partition('.')
            if idx not in data:
                data[idx] = {}
            data = data[idx]
        data[key] = value

    with open(manifest_path, 'w', encoding="utf-8") as f:
        json.dump(manifest_data, f, sort_keys=False, indent=2, separators=(',', ': '))
        f.write('\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('manifest_path')
    parser.add_argument('operation', choices=('set', 'del'))
    parser.add_argument('key')
    parser.add_argument('value', nargs='?')
    parser.add_argument('--json-value', action='store_true', default=False)

    args = parser.parse_args()

    update_manifest(args.manifest_path, args.operation, args.key, args.value, args.json_value)
