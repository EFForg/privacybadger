#!/usr/bin/env python3

import json
import re
import sys
import urllib.request

from collections import OrderedDict
#from tldextract import TLDExtract

dnt_domains = []

with urllib.request.urlopen('https://www.eff.org/files/effdntlist.txt') as response:
    regex = r'^@@\|\|(.*)\^\$third-party$'
    for line in response:
        match = re.match(regex, line.decode('utf-8').strip())
        if match:
            dnt_domains.append(match.groups()[0])

with open(sys.argv[1], 'r+') as f:
    # read in the data, preserving ordering
    data = json.load(f, object_pairs_hook=OrderedDict)

    # see if any domains from EFF's DNT policy scan list
    # are blocked but not declared as DNT compliant
    # TODO deal with base domains/subdomains
    #tld_extract = TLDExtract(cache_file=False)
    #tld_extract(domain).registered_domain
    # TODO can we just use endswith?
    for domain in dnt_domains:
        if domain in data['action_map']:
            if "dnt" not in data['action_map'] or not data['action_map'][domain]['dnt']:
                print("OHOH: %s" % domain)
                # TODO fix

    # write the data back out
    f.seek(0)
    # this should match how data gets written out by Badger Sett
    json.dump(data, f, indent=2, sort_keys=True, separators=(',', ': '))
