#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from functools import partial

from pbtest import retry_until
from window_utils import switch_to_window_with_url


class FingerprintingDetectionTest(pbtest.PBSeleniumTest):
    """Tests to make sure fingerprinting detection works as expected."""

    def detected_fingerprinting(self, domain):
        return self.js("""let tracker_origin = window.getBaseDomain("{}");
return (
  Object.keys(badger.tabData).some(tab_id => {{
    let fpData = badger.tabData[tab_id].fpData;
    return fpData &&
      fpData.hasOwnProperty(tracker_origin) &&
      fpData[tracker_origin].canvas &&
      fpData[tracker_origin].canvas.fingerprinting === true;
  }})
);""".format(domain))

    def detected_tracking(self, domain, page_url):
        return self.js("""let tracker_origin = window.getBaseDomain("{}"),
  site_origin = window.getBaseDomain((new URI("{}")).host),
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

        # open Badger's background page
        self.load_url(self.bg_url, wait_on_site=1)

        # need to keep Badger's background page open for tabData to persist
        # so, open and switch to a new window
        self.open_window()

        # visit the page
        self.load_url(PAGE_URL)

        # switch back to Badger's background page
        switch_to_window_with_url(self.driver, self.bg_url)

        # check that we detected the fingerprinting domain as a tracker
        self.assertTrue(
            retry_until(partial(self.detected_tracking, FINGERPRINTING_DOMAIN, PAGE_URL)),
            "Canvas fingerprinting resource was detected as a tracker.")

        # check that we detected canvas fingerprinting
        self.assertTrue(
            self.detected_fingerprinting(FINGERPRINTING_DOMAIN),
            "Canvas fingerprinting resources was detected as a fingerprinter."
        )


if __name__ == "__main__":
    unittest.main()
