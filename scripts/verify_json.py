#!/usr/bin/env python3

import json
import sys

KEYS = set(['snitch_map', 'action_map', 'version'])

with open(sys.argv[1]) as f:
    try:
        js = json.load(f)
        if set(js.keys()) == KEYS:
            sys.exit(0)
        else:
            print("json keys %s are not correct" % js.keys())
            sys.exit(1)
    except Exception as e:
        print("error parsing json:", e)
        sys.exit(1)
