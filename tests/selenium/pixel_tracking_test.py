#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest

class PixelTrackingTesting(pbtest.PBSeleniumTest):
    """Tests for the cookie pixel tracking heuristic included in heuristicblocking.js
        - loads gitcdn resource which places a tracking cookie on page then creates an img tag
        - img tag makes a src request carrying a substring of that tracking cookie
        - tracking domain is caught by pixel tracking heuristic, snitch map entry is updated
    """

    def test_that_tracker_is_caught(self):
        TESTING_URL = ("https://eff.org/files/badger_test_fixtures/pixel_tracking/resource.html")

        CLEAR_TRAINED_DATA = (
            "chrome.extension.getBackgroundPage().badger.storage.clearTrackerData();"
        )

        CHECK_SNITCH_MAP_FOR_ENTRY = (
        		"return chrome.extension.getBackgroundPage()."
        		"badger.storage.snitch_map.getItem('cloudinary.com').includes('eff.org');"
        )

        self.load_url(self.options_url)
        self.js(CLEAR_TRAINED_DATA)
        self.load_url(TESTING_URL)

        # should resolve to false without the query parameter explicitly passed to track
        self.assertFalse(
        	self.js(CHECK_SNITCH_MAP_FOR_ENTRY)
        )

        self.load_url(TESTING_URL + "?trackMe=true")

        # now that the query param has been passed in, check for presence of domain
        self.assertTrue(
        	self.js(CHECK_SNITCH_MAP_FOR_ENTRY)
)

if __name__ == "__main__":
    unittest.main()
