#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from functools import partial

from pbtest import retry_until


class FingerprintingTest(pbtest.PBSeleniumTest):
    """Tests to make sure fingerprinting detection works as expected."""

    def detected_fingerprinting(self, domain):
        return self.js("""let tracker_origin = window.getBaseDomain("{}");
let tabData = chrome.extension.getBackgroundPage().badger.tabData;
return (
  Object.keys(tabData).some(tab_id => {{
    let fpData = tabData[tab_id].fpData;
    return fpData &&
      fpData.hasOwnProperty(tracker_origin) &&
      fpData[tracker_origin].canvas &&
      fpData[tracker_origin].canvas.fingerprinting === true;
  }})
);""".format(domain))

    def detected_tracking(self, domain, page_url):
        return self.js("""let tracker_origin = window.getBaseDomain("{}"),
  site_origin = window.getBaseDomain((new URI("{}")).host),
  map = chrome.extension.getBackgroundPage().badger.storage.snitch_map.getItemClones();

return (
  map.hasOwnProperty(tracker_origin) &&
    map[tracker_origin].indexOf(site_origin) != -1
);""".format(domain, page_url))

    # TODO can fail because our content script runs too late: https://crbug.com/478183
    @pbtest.repeat_if_failed(3)
    def test_canvas_fingerprinting_detection(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "fingerprinting.html"
        )
        FINGERPRINTING_DOMAIN = "cdn.jsdelivr.net"

        # clear pre-trained/seed tracker data
        self.load_url(self.options_url)
        self.js("chrome.extension.getBackgroundPage().badger.storage.clearTrackerData();")

        # visit the page
        self.load_url(FIXTURE_URL)

        # now open a new window (to avoid clearing badger.tabData)
        # and verify results
        self.open_window()

        # check that we detected the fingerprinting domain as a tracker
        self.load_url(self.options_url)
        # TODO unnecessary retrying?
        self.assertTrue(
            retry_until(partial(self.detected_tracking, FINGERPRINTING_DOMAIN, FIXTURE_URL)),
            "Canvas fingerprinting resource was detected as a tracker.")

        # check that we detected canvas fingerprinting
        self.assertTrue(
            self.detected_fingerprinting(FINGERPRINTING_DOMAIN),
            "Canvas fingerprinting resource was detected as a fingerprinter."
        )


if __name__ == "__main__":
    unittest.main()
