#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest

class PixelTrackingTest(pbtest.PBSeleniumTest):
    """Tests for the pixel cookie sharing heuristic included in heuristicblocking.js
        - loads HTML fixture that sets a first-party cookie on page then creates an img tag
        - if `trackMe=true` is present in the query string, img tag makes a src request carrying a substring of that tracking cookie
        - tracking domain is caught by pixel tracking heuristic, snitch map entry is updated
    """

    def test_pixel_cookie_sharing(self):
        FIXTURE_URL = "https://www.eff.org/files/badger_test_fixtures/pixel_cookie_sharing2.html"

        CLEAR_TRAINED_DATA = (
            "chrome.extension.getBackgroundPage()."
            "badger.storage.clearTrackerData();"
        )

        CHECK_SNITCH_MAP = (
            "return ("
            "  chrome.extension.getBackgroundPage().badger.storage.snitch_map.getItem('cloudinary.com') &&"
            "  chrome.extension.getBackgroundPage().badger.storage.snitch_map.getItem('cloudinary.com').includes('eff.org')"
            ");"
        )

        # clear seed data to prevent any potential false positives
        self.js(CLEAR_TRAINED_DATA)

        # load the test fixture without the URL parameter to to verify there is no tracking on the page by default
        # check to make sure the domain wasn't logged in snitch map
        self.load_url(FIXTURE_URL)
        self.load_url(self.options_url)
        self.assertFalse(
            self.js(CHECK_SNITCH_MAP),
            "Tracking detected but page expected to have no tracking at this point"
        )

        # load the same test fixture, but pass the URL parameter for it to perform pixel cookie sharing
        # check to make sure this domain is caught and correctly recorded in snitch map
        self.load_url(FIXTURE_URL + "?trackMe=true")
        self.load_url(self.options_url)
        self.assertTrue(
            self.js(CHECK_SNITCH_MAP),
            "Pixel cookie sharing tracking failed to be detected"
        )

if __name__ == "__main__":
    unittest.main()
