#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest


class FingerprintingDetectionTest(pbtest.PBSeleniumTest):
    """Tests to make sure fingerprinting detection works as expected."""

    def detected_tracking(self, domain, page_url):
        return self.js("""let tracker_origin = window.getBaseDomain("{}"),
  site_origin = window.getBaseDomain(utils.makeURI("{}").host),
  map = badger.storage.snitch_map.getItemClones();

return (
  map.hasOwnProperty(tracker_origin) &&
    map[tracker_origin].indexOf(site_origin) != -1
);""".format(domain, page_url))

    def test_canvas_fingerprinting_detection(self):
        PAGE_URL = (
            "https://cdn.rawgit.com/ghostwords"
            "/ff6347b93ec126d4f73a9ddfd8b09919/raw/2332f82d3982bd4a84cd2380aed90228955d1f2a"
            "/privacy_badger_fingerprint_test_fixture.html"
        )
        FINGERPRINTING_DOMAIN = "cdn.jsdelivr.net"

        # visit the page
        self.load_url(PAGE_URL)

        # open Badger's background page
        self.open_window()
        self.load_url(self.bg_url, wait_on_site=1)

        # check that we detected the fingerprinting domain as a tracker
        self.assertTrue(
            self.detected_tracking(FINGERPRINTING_DOMAIN, PAGE_URL),
            "Canvas fingerprinting resource was detected as a tracker."
        )


if __name__ == "__main__":
    unittest.main()
