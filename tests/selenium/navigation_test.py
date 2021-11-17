#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest


class NavigationTest(pbtest.PBSeleniumTest):
    """Verifies navigation-related fixes and workarounds."""

    def get_trackers(self):
        self.driver.switch_to.window(self.driver.window_handles[-2])
        trackers = self.js(
            "let badger = chrome.extension.getBackgroundPage().badger;"
            "return badger.tabData[Object.keys(badger.tabData)[0]].origins;"
        )
        self.driver.switch_to.window(self.driver.window_handles[-1])
        return trackers

    def test_beacon_attribution(self):
        FIXTURE_HOST = "efforg.github.io"
        FIXTURE_URL = (
            "https://" + FIXTURE_HOST + "/privacybadger-test-fixtures/html/"
            "beacon.html"
        )
        THIRD_PARTY_HOST = "privacybadger-tests.eff.org"

        # block the third-party domain
        self.block_domain(THIRD_PARTY_HOST)

        # make sure the options page is open
        if self.driver.current_url != self.options_url:
            self.load_url(self.options_url)

        # open a new window and navigate to the test page
        self.open_window()
        self.load_url(FIXTURE_URL)

        # verify no trackers
        assert self.get_trackers() == {}, "beacon should not have fired yet"

        # verify one tracker after page refresh
        self.driver.refresh()
        trackers = pbtest.retry_until(self.get_trackers)
        assert trackers == {THIRD_PARTY_HOST: "block"}, (
            "beacon should have fired and gotten blocked")

        # visit a different site (doesn't matter what it is,
        # just needs to be an http site with a different domain)
        self.load_url("https://dnt-test.trackersimulator.org/")

        # verify no trackers
        assert self.get_trackers() == {}, (
            "beacon should not have gotten attributed to an unrelated site")


if __name__ == "__main__":
    unittest.main()
