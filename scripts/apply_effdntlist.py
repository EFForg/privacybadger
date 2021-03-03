#!/usr/bin/env python3

import json
import random
import re
import sys
import time
import urllib.request

from collections import OrderedDict

from tldextract import TLDExtract


DNT_LIST_URL = 'https://www.eff.org/files/effdntlist.txt'


def get_dnt_domains():
    dnt_domains = []

    with urllib.request.urlopen(DNT_LIST_URL) as response:
        domain_regex = r'^@@\|\|(.*)\^\$third-party$'
        for line in response:
            match = re.match(domain_regex, line.decode('utf-8').strip())
            if match:
                dnt_domains.append(match.groups()[0])

    return dnt_domains

def get_next_update_time():
    epoch_now = int(time.time()) * 1000
    one_day = 1000 * 60 * 60 * 24
    return random.randint(epoch_now + one_day, epoch_now + one_day * 7)

def apply_dnt_domains(data, dnt_domains):
    tld_extract = TLDExtract(cache_dir=False)

    for domain in dnt_domains:
        parsed_tld = tld_extract(domain)
        base = parsed_tld.domain + '.' + parsed_tld.suffix

        # only apply DNT scan results for domains
        # that are already present in seed data
        # and are blocked
        if base not in data['action_map'] or data['action_map'][base]['heuristicAction'] != "block":
            continue

        if domain in data['action_map']:
            if "dnt" not in data['action_map'][domain] or not data['action_map'][domain]['dnt']:
                print("Marking %s as DNT compliant ..." % domain)
                data['action_map'][domain]['dnt'] = True
                data['action_map'][domain]['nextUpdateTime'] = get_next_update_time()
        else:
            print("Adding %s as DNT compliant ..." % domain)
            data['action_map'][domain] = {
                "dnt": True,
                "heuristicAction": "",
                "nextUpdateTime": get_next_update_time(),
            }

    return data


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: %s BADGER_SEED_DATA.json" % sys.argv[0])
        sys.exit(1)

    # get DNT scan results
    dnt_domains = get_dnt_domains()
    if not dnt_domains:
        print("No DNT list domains loaded!")
        sys.exit(1)

    with open(sys.argv[1], 'r+') as seed_file:
        # read in seed data, preserving ordering
        seed_data = json.load(seed_file, object_pairs_hook=OrderedDict)

        # apply DNT scan results to seed data
        seed_data = apply_dnt_domains(seed_data, dnt_domains)

        # write the data back out
        seed_file.seek(0)
        # this should match how data gets written out by Badger Sett
        json.dump(seed_data, seed_file, indent=2, sort_keys=True, separators=(',', ': '))
