#!/usr/bin/env python

import unittest

import pytest

import pbtest

from functools import partial


class NavigationTest(pbtest.PBSeleniumTest):
    """Verifies navigation-related fixes and workarounds."""

    def get_trackers(self, url):
        trackers = self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.tabs.query({ url: arguments[0] }, function (tabs) {"
            "  if (!tabs[0]) {"
            "    done(null);"
            "  }"
            "  chrome.runtime.sendMessage({ type: 'getTabData' }, tabData => {"
            "    done(tabData[tabs[0].id].trackers);"
            "  });"
            "});", url)
        return trackers

    @pytest.mark.flaky(reruns=5) # TODO why is this flaky in MV3?
    def test_beacon_attribution(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "beacon.html"
        )
        OTHER_SITE_URL = "https://dnt-test.trackersimulator.org/"
        THIRD_PARTY_HOST = "privacybadger-tests.eff.org"

        self.clear_tracker_data()
        # enable local learning
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

        self.load_url(FIXTURE_URL)
        # open new window (to avoid clearing badger.tabData) and verify results
        self.open_window()
        self.load_url(self.options_url)
        assert self.get_trackers(FIXTURE_URL) == {}, "beacon should not have fired yet"

        # verify beacon domain is listed after page refresh
        self.driver.switch_to.window(self.driver.window_handles[-2])
        self.driver.refresh()
        self.driver.switch_to.window(self.driver.window_handles[-1]) 
        domains = pbtest.retry_until(partial(self.get_trackers, FIXTURE_URL),
                                     tester=lambda x: x == {THIRD_PARTY_HOST: "allow"},
                                     times=3)
        assert domains == {THIRD_PARTY_HOST: "allow"}, "beacon should have fired"

        # visit a different site (doesn't matter what it is,
        # just needs to be an http site with a different domain)
        self.driver.switch_to.window(self.driver.window_handles[-2])
        self.load_url(OTHER_SITE_URL)
        # verify no domains are listed
        self.driver.switch_to.window(self.driver.window_handles[-1])
        assert self.get_trackers(OTHER_SITE_URL) == {}, "beacon got wrongly attributed to an unrelated site"


if __name__ == "__main__":
    unittest.main()
