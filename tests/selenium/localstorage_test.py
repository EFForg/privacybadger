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

    - whitelistUrl
    - badgerHashes
    - showCounter

    Also make sure that "disabledSites" is not initialized.
    """
    def check_policy_download(self):
        timeout = POLICY_DOWNLOAD_TIMEOUT
        # give updatePrivacyPolicyHashes() sometime to download the policy hash
        while (timeout > 0 and 
                not self.js("return (pb.storage.getBadgerStorageObject('dnt_hashes') != {})")):
            sleep(1)
            timeout -= 1

        # make sure we didn't time-out
        self.assertGreater(timeout, 0,
            "Timed out while waiting for the localStorage.badgerHashes")
        # now check the downloaded policy hash
        policy_hash = self.js("return (pb.storage.getBadgerStorageObject('dnt_hashes').getItemClones())")
        for k, v in policy_hash.items():
            # self.assertIn("DNT Policy", k)  # e.g. DNT Policy V1.0
            self.assertEqual(PB_POLICY_HASH_LEN, len(k))  # check hash length

    def test_should_init_local_storage_entries(self):
        self.load_url(pbtest.PB_CHROME_BG_URL)
        js = self.js
        self.check_policy_download()
        self.assertEqual(js("return constants.COOKIE_BLOCK_LIST_URL"),
                         "https://www.eff.org/files/cookieblocklist_new.txt")

        disabled_sites = js("return (pb.storage.getBadgerStorageObject('settings_map').getItem('disabledSites'))");

        self.assertFalse(len(disabled_sites),
                         "Shouldn't have any disabledSites after installation")
        # TODO: do we expect currentVersion to be present after the first run?


if __name__ == "__main__":
    unittest.main()
