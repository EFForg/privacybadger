#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import pytest
import unittest

import pbtest

from functools import partial


class SupercookieTest(pbtest.PBSeleniumTest):
    """Make sure we detect potential supercookies. """

    def get_snitch_map_for(self, domain):
        self.open_window() # don't replace the test page to allow for retrying
        return self.get_badger_storage('snitch_map').get(domain)

    def setUp(self):
        # enable local learning
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

    # test for https://github.com/EFForg/privacybadger/pull/1403
    @pytest.mark.xfail(pbtest.shim.browser_type == "chrome" and "beta" in pbtest.shim.browser_path.lower(), reason="chromedriver bug")
    def test_async_tracking_attribution_bug(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "async_localstorage_attribution_bug.html"
        ))

        # the above HTML page reloads itself furiously to trigger our bug
        # we need to wait for it to finish reloading
        self.wait_for_script("return window.DONE_RELOADING === true")

        # the HTML page contains:

        # an iframe from THIRD_PARTY_BASE that writes to localStorage
        self.assertEqual(
            [FIRST_PARTY_BASE],
            pbtest.retry_until(partial(self.get_snitch_map_for, THIRD_PARTY_BASE)),
            msg="Frame sets localStorage but was not flagged as a tracker.")

        # and an image from raw.githubusercontent.com that doesn't do any tracking
        self.assertFalse(self.get_snitch_map_for("raw.githubusercontent.com"),
            msg="Image is not a tracker but was flagged as one.")


    def test_should_detect_ls_of_third_party_frame(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)

        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "localstorage.html"
        ))

        # TODO We get some intermittent failures for this test.
        # It seems we sometimes miss the setting of localStorage items
        # because the script runs after we already checked what's in localStorage.
        # We can work around this race condition by reloading the page.
        self.driver.refresh()

        self.assertEqual(
            [FIRST_PARTY_BASE],
            pbtest.retry_until(partial(self.get_snitch_map_for, THIRD_PARTY_BASE), times=3)
        )

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"
        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)
        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "localstorage_low_entropy.html"
        ))
        self.driver.refresh()
        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)

    def test_should_not_detect_first_party_ls(self):
        BASE_DOMAIN = "efforg.github.io"
        self.load_url((
            f"https://{BASE_DOMAIN}/privacybadger-test-fixtures/html/"
            "localstorage/set_ls.html"
        ))
        self.driver.refresh()
        assert not self.get_snitch_map_for(BASE_DOMAIN)

    def test_should_not_detect_ls_of_third_party_script(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "localstorage_from_third_party_script.html"
        ))

        self.driver.refresh()

        assert not self.get_snitch_map_for(FIRST_PARTY_BASE)
        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)

    def test_localstorage_learning(self):
        """Verifies that we learn to block a third-party domain if we see
        non-trivial localstorage data from that third-party on three sites."""

        SITE1_URL = "https://ddrybktjfxh4.cloudfront.net/localstorage.html"
        SITE2_URL = "https://d3syxqe9po5ji0.cloudfront.net/localstorage.html"
        SITE3_URL = "https://d3b37ucnz1m2l2.cloudfront.net/localstorage.html"

        THIRD_PARTY = "efforg.github.io"

        # remove pre-trained domains
        self.clear_tracker_data()

        # load the first site
        self.load_url(SITE1_URL)
        self.open_popup(SITE1_URL)
        sliders = self.get_tracker_state()
        assert THIRD_PARTY in sliders['notYetBlocked']
        self.close_window_with_url(SITE1_URL)

        # go to second site
        self.load_url(SITE2_URL)
        self.open_popup(SITE2_URL)
        sliders = self.get_tracker_state()
        assert THIRD_PARTY in sliders['notYetBlocked']
        self.close_window_with_url(SITE2_URL)

        # go to third site
        self.load_url(SITE3_URL)
        self.open_popup(SITE3_URL)
        sliders = self.get_tracker_state()
        assert THIRD_PARTY in sliders['blocked']
        self.close_window_with_url(SITE3_URL)


if __name__ == "__main__":
    unittest.main()
