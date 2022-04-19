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

    def get_snitch_map(self):
        return self.get_badger_storage('snitch_map').get('cloudinary.com')

    def setUp(self):
        # enable local learning
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

    def test_pixel_cookie_sharing(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "pixel_cookie_sharing.html"
        )

        # clear seed data to prevent any potential false positives
        self.clear_tracker_data()

        # load the test fixture without the URL parameter to to verify there is no tracking on the page by default
        self.load_url(FIXTURE_URL)
        # check to make sure the domain wasn't logged in snitch map
        assert not self.get_snitch_map(), (
            "Tracking detected but page expected to have no tracking at this point")

        # load the same test fixture, but pass the URL parameter for it to perform pixel cookie sharing
        self.load_url(FIXTURE_URL + "?trackMe=true")
        # check to make sure this domain is caught and correctly recorded in snitch map
        assert ["efforg.github.io"] == self.get_snitch_map(), (
            "Pixel cookie sharing tracking failed to be detected")


if __name__ == "__main__":
    unittest.main()
