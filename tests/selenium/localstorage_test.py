#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
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
        dnt_hashes_not_empty =\
            "return (badger.storage.getBadgerStorageObject('dnt_hashes') != {})"
        # give updatePrivacyPolicyHashes() sometime to download the policy hash
        while (timeout > 0 and not self.js(dnt_hashes_not_empty)):
            sleep(1)
            timeout -= 1

        # make sure we didn't time-out
        self.assertGreater(timeout, 0,
                           "Timed out while waiting for the "
                           "localStorage.badgerHashes")
        # now check the downloaded policy hash
        get_dnt_hashes =\
            "return (badger.storage.getBadgerStorageObject('dnt_hashes')."\
            "getItemClones())"
        policy_hashes = self.js(get_dnt_hashes)
        for policy_hash in policy_hashes.keys():
            self.assertEqual(PB_POLICY_HASH_LEN, len(policy_hash))

    def test_should_init_local_storage_entries(self):
        self.load_url(self.bg_url, wait_on_site=3)
        js = self.js
        self.check_policy_download()
        self.assertEqual(js("return constants.YELLOWLIST_URL"),
                         "https://www.eff.org/files/cookieblocklist_new.txt")

        get_disabled_sites = "return (badger.storage.getBadgerStorageObject("\
            "'settings_map').getItem('disabledSites'))"
        disabled_sites = js(get_disabled_sites)

        self.assertFalse(len(disabled_sites),
                         "Shouldn't have any disabledSites after installation")
        
        self.assertTrue(js("return (badger.storage.getBadgerStorageObject("\
            "'settings_map').getItem('checkForDNTPolicy'))"),
            "Should start with DNT policy enabled")
        # TODO: do we expect currentVersion to be present after the first run?


if __name__ == "__main__":
    unittest.main()
