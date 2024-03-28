#!/usr/bin/env python

import unittest

import pbtest


class CookieTest(pbtest.PBSeleniumTest):
    """Basic test to make sure the PB doesn't mess up with the cookies."""

    def assert_pass_opera_cookie_test(self, url, test_name):
        self.load_url(url)
        assert self.txt_by_css("#result") == "PASS", (
            f"Cookie test failed: {test_name}")

    def test_should_pass_std_cookie_test(self):
        self.assert_pass_opera_cookie_test((
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "first_party_cookie.html"
        ), "Set 1st party cookie")

    def test_cookie_tracker_detection(self):
        """Tests basic cookie tracking. The tracking site has no DNT file,
        and gets blocked by PB.

        Visits three sites, all of which have an iframe that points to a fourth site
        that reads and writes a cookie. The third party cookie will be picked up by
        PB after each of the site loads, but no action will be taken. Then the first
        site will be reloaded, and the UI will show the third party domain as blocked."""

        SITE1_URL = "https://ddrybktjfxh4.cloudfront.net/"
        SITE2_URL = "https://d3syxqe9po5ji0.cloudfront.net/"
        SITE3_URL = "https://d3b37ucnz1m2l2.cloudfront.net/"

        THIRD_PARTY_DOMAIN = "efforg.github.io"

        # remove pre-trained domains
        self.clear_tracker_data()

        # enable local learning
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

        # load the first site with the third party code that reads and writes a cookie
        self.load_url(SITE1_URL)
        self.open_popup(SITE1_URL)
        # TODO it takes another visit (or a page reload)
        # TODO to show the domain as not-yet-blocked-but-tracking?
        #sliders = self.get_tracker_state()
        #assert THIRD_PARTY_DOMAIN in sliders['notYetBlocked']
        self.close_window_with_url(SITE1_URL)

        # go to second site
        self.load_url(SITE2_URL)
        self.open_popup(SITE2_URL)
        sliders = self.get_tracker_state()
        assert THIRD_PARTY_DOMAIN in sliders['notYetBlocked']
        self.close_window_with_url(SITE2_URL)

        # go to third site
        self.load_url(SITE3_URL)
        self.open_popup(SITE3_URL)
        sliders = self.get_tracker_state()
        assert THIRD_PARTY_DOMAIN in sliders['notYetBlocked']
        self.close_window_with_url(SITE3_URL)

        # revisiting the first site should cause
        # the third-party domain to be blocked
        self.load_url(SITE1_URL)
        self.open_popup(SITE1_URL)
        sliders = self.get_tracker_state()
        assert THIRD_PARTY_DOMAIN in sliders['blocked']


if __name__ == "__main__":
    unittest.main()
