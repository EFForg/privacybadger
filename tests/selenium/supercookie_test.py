#!/usr/bin/env python
# -*- coding: UTF-8 -*-

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

    def test_should_detect_ls_of_third_party_frame(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)

        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "localstorage.html"
        ))

        # TODO FIXME We get some intermittent failures for this test.
        # It seems we sometimes miss the setting of localStorage items
        # because the script runs after we already checked what's in localStorage.
        # We can work around this race condition by reloading the page.
        self.driver.refresh()

        snitch_map = pbtest.retry_until(
            partial(self.get_snitch_map_for, THIRD_PARTY_BASE),
            times=3)
        assert snitch_map == [FIRST_PARTY_BASE]

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"
        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)
        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "localstorage_low_entropy.html"
        ))
        self.driver.refresh() # TODO workaround
        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)

    def test_should_not_detect_first_party_ls(self):
        BASE_DOMAIN = "efforg.github.io"
        self.load_url((
            f"https://{BASE_DOMAIN}/privacybadger-test-fixtures/html/"
            "localstorage/set_ls.html"
        ))
        self.driver.refresh() # TODO workaround
        assert not self.get_snitch_map_for(BASE_DOMAIN)

    def test_should_not_detect_ls_of_third_party_script(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url((
            f"https://privacybadger-tests.{FIRST_PARTY_BASE}/html/"
            "localstorage_from_third_party_script.html"
        ))

        self.driver.refresh() # TODO workaround

        assert not self.get_snitch_map_for(FIRST_PARTY_BASE)
        assert not self.get_snitch_map_for(THIRD_PARTY_BASE)

    def test_localstorage_learning(self):
        """Verifies that we learn to block a third-party domain if we see
        non-trivial localStorage data from that third-party on three sites."""

        SITE1_URL = "https://ddrybktjfxh4.cloudfront.net/localstorage.html"
        SITE2_URL = "https://d3syxqe9po5ji0.cloudfront.net/localstorage.html"
        SITE3_URL = "https://d3b37ucnz1m2l2.cloudfront.net/localstorage.html"

        THIRD_PARTY = "efforg.github.io"

        # remove pre-trained domains
        self.clear_tracker_data()

        def get_sliders(url, category):
            self.open_popup(url)
            sliders = self.get_tracker_state()
            return sliders[category]

        # load the first site
        self.load_url(SITE1_URL)
        # TODO FIXME remove workaround once we fix race conditions in contentscripts/supercookie.js
        self.driver.refresh()
        sliders = pbtest.retry_until(
            partial(get_sliders, SITE1_URL, 'notYetBlocked'), times=3)
        assert THIRD_PARTY in sliders

        # go to second site
        self.load_url(SITE2_URL)
        # TODO workaround
        self.driver.refresh()
        sliders = pbtest.retry_until(
            partial(get_sliders, SITE2_URL, 'notYetBlocked'), times=3)
        assert THIRD_PARTY in sliders

        # go to third site
        self.load_url(SITE3_URL)
        # TODO workaround
        self.driver.refresh()
        sliders = pbtest.retry_until(
            partial(get_sliders, SITE3_URL, 'blocked'), times=3)
        assert THIRD_PARTY in sliders, "third party should now be reported as blocked"


if __name__ == "__main__":
    unittest.main()
