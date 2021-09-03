#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
from time import sleep

# time to wait for loading privacy policy from eff.org
POLICY_DOWNLOAD_TIMEOUT = 20
PB_POLICY_HASH_LEN = 40  # https://www.eff.org/files/dnt-policies.json


class StorageTest(pbtest.PBSeleniumTest):
    """Privacy Badger storage initialization tests."""

    def check_policy_download(self):
        timeout = POLICY_DOWNLOAD_TIMEOUT
        dnt_hashes_not_empty = (
            "return ("
            "chrome.extension.getBackgroundPage()."
            "badger.storage.getStore('dnt_hashes') != {}"
            ")"
        )
        # give updatePrivacyPolicyHashes() some time to download the policy hash
        while (timeout > 0 and not self.js(dnt_hashes_not_empty)):
            sleep(1)
            timeout -= 1

        # make sure we didn't time out
        self.assertGreater(timeout, 0, "Timed out waiting for DNT hashes")
        # now check the downloaded policy hash
        get_dnt_hashes = (
            "return ("
            "chrome.extension.getBackgroundPage()."
            "badger.storage.getStore('dnt_hashes')."
            "getItemClones()"
            ")"
        )
        policy_hashes = self.js(get_dnt_hashes)
        for policy_hash in policy_hashes.keys():
            self.assertEqual(PB_POLICY_HASH_LEN, len(policy_hash))

    def test_should_init_storage_entries(self):
        self.load_url(self.options_url)

        self.check_policy_download()
        self.assertEqual(
            "https://www.eff.org/files/cookieblocklist_new.txt",
            self.js(
                "return chrome.extension.getBackgroundPage()."
                "constants.YELLOWLIST_URL"
            ) 
        )

        disabled_sites = self.js(
            "return chrome.extension.getBackgroundPage()."
            "badger.getSettings().getItem('disabledSites')"
        )
        self.assertFalse(
            len(disabled_sites),
            "Shouldn't have any disabledSites after installation"
        )

        self.assertTrue(self.js(
            "return chrome.extension.getBackgroundPage()."
            "badger.getSettings().getItem('checkForDNTPolicy')"
        ), "Should start with DNT policy enabled")


if __name__ == "__main__":
    unittest.main()
