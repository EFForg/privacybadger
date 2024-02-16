#!/usr/bin/env python

import unittest

import pbtest

PB_POLICY_HASH_LEN = 40  # https://www.eff.org/files/dnt-policies.json


class StorageTest(pbtest.PBSeleniumTest):
    """Privacy Badger storage initialization tests."""

    def test_should_init_storage_entries(self):
        policy_hashes = self.get_badger_storage('dnt_hashes')
        for policy_hash in policy_hashes.keys():
            assert PB_POLICY_HASH_LEN == len(policy_hash)

        badger_settings = self.get_badger_storage('settings_map')
        assert badger_settings['disabledSites'] == [], (
            "Shouldn't have any disabledSites after installation")
        assert badger_settings['checkForDNTPolicy'], (
            "Should start with DNT policy enabled")

        private_settings = self.get_badger_storage('private_storage')
        version_in_storage = private_settings['badgerVersion']
        version_in_manifest = self.js("return chrome.runtime.getManifest().version")
        assert version_in_storage == version_in_manifest, (
            "private_storage should contain the correct version string")


if __name__ == "__main__":
    unittest.main()
