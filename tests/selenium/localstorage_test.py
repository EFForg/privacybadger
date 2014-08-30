#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
import json
from time import sleep

# time to wait for loading privacy policy from eff.org
POLICY_HASH_DOWNLOAD_TIMEOUT = 20
PB_POLICY_HASH_LEN = 40  # https://www.eff.org/files/dnt-policies.json
PB_POLICY_KEY = "Preliminary DNT Policy"


class LocalStorageTest(pbtest.PBSeleniumTest):
    """Make sure the following localStorage items are initialized correctly.

    - enabled
    - whitelistUrl
    - currentVersion
    - shouldShowIcon,
    - shouldShowBlockElementMenu
    - badgerHashes

    Also make sure that "disabledSites" is not initialized.
    """

    def test_should_init_local_storage_entries(self):
        self.driver.get(pbtest.PB_CHROME_BG_URL)
        assertTrue = self.assertTrue
        timeout = POLICY_HASH_DOWNLOAD_TIMEOUT
        # give updatePrivacyPolicyHashes() sometime to download the policy hash
        while (timeout > 0 and not
               self.js("return ('badgerHashes' in localStorage)")):
            sleep(1)
            timeout -= 1
        # make sure we didn't time-out
        self.assertGreater(timeout, 0,
            "Timed out while waiting for the localStorage.badgerHashes")

        policy_hash = self.js("return localStorage.badgerHashes")
        print "Downloaded policy hash in %s seconds: %s" %\
            (POLICY_HASH_DOWNLOAD_TIMEOUT - timeout, policy_hash)
        try:
            policy_json = json.loads(policy_hash)
        except:
            self.fail("localStorage.badgerHashes is not valid JSON")

        self.assertEqual(PB_POLICY_HASH_LEN,
                         len(policy_json[PB_POLICY_KEY]))

        assertTrue(self.js("return localStorage.enabled"))
        self.assertEqual(self.js("return localStorage.whitelistUrl"),
                    "https://www.eff.org/files/cookieblocklist.txt")
        assertTrue(self.js("return localStorage.shouldShowIcon"))
        assertTrue(self.js("return localStorage.shouldShowBlockElementMenu"))

        disabled_sites = self.js("return ('disabledSites' in localStorage && "
                        "JSON.parse(localStorage.disabledSites).length > 0)")
        self.assertFalse(disabled_sites,
                         "Shouldn't have any disabledSites after installation")
        #assertTrue(self.js("return 'currentVersion' in localStorage"))
        #print "Version:", self.js("return localStorage.currentVersion")
        # TODO: check if we expect currentVersion to be present after first run
        # Sometimes it just doesn't show up in the localStorage for some time.


if __name__ == "__main__":
    unittest.main()
