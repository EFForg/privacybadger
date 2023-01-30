#!/usr/bin/env python3

import json
import sys

KEYS = set(['snitch_map', 'action_map', 'tracking_map', 'version'])

with open(sys.argv[1], encoding="utf-8") as f:
    try:
        js = json.load(f)
        if set(js.keys()) == KEYS:
            sys.exit(0)
        else:
            print(f"json keys {js.keys()} are not correct")
            sys.exit(1)
    except Exception as e:
        print("error parsing json:", e)
        sys.exit(1)
