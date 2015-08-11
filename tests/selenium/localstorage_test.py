#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
import json
from time import sleep

# time to wait for loading privacy policy from eff.org
POLICY_DOWNLOAD_TIMEOUT = 20
PB_POLICY_HASH_LEN = 40  # https://www.eff.org/files/dnt-policies.json


class LocalStorageTest(pbtest.PBSeleniumTest):
    """Make sure the following localStorage items are initialized correctly.

    - enabled
    - whitelistUrl
    - badgerHashes

    Also make sure that "disabledSites" is not initialized.
    """
    def check_policy_download(self):
        timeout = POLICY_DOWNLOAD_TIMEOUT
        # give updatePrivacyPolicyHashes() sometime to download the policy hash
        while (timeout > 0 and
               not self.js("return ('badgerHashes' in localStorage)")):
            sleep(1)
            timeout -= 1

        # make sure we didn't time-out
        self.assertGreater(timeout, 0,
            "Timed out while waiting for the localStorage.badgerHashes")
        # now check the downloaded policy hash
        policy_hash = self.js("return localStorage.badgerHashes")
        print "Downloaded policy hash in %s seconds: %s" %\
            (POLICY_DOWNLOAD_TIMEOUT - timeout, policy_hash)
        try:
            policy_json = json.loads(policy_hash)
        except:
            self.fail("localStorage.badgerHashes is not valid JSON")
        for _, v in policy_json.iteritems():
            # self.assertIn("DNT Policy", k)  # e.g. DNT Policy V1.0
            self.assertEqual(PB_POLICY_HASH_LEN, len(v))  # check hash length

    def test_should_init_local_storage_entries(self):
        self.driver.get(pbtest.PB_CHROME_BG_URL)
        js = self.js
        self.check_policy_download()
        self.assertEqual(js("return localStorage.whitelistUrl"),
                         "https://www.eff.org/files/cookieblocklist.txt")

        disabled_sites = js("return ('disabledSites' in localStorage && "
                            "JSON.parse(localStorage.disabledSites).length > 0)")
        self.assertFalse(disabled_sites,
                         "Shouldn't have any disabledSites after installation")
        # TODO: do we expect currentVersion to be present after the first run?


if __name__ == "__main__":
    unittest.main()
