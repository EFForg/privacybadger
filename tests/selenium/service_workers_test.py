#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest


class ServiceWorkersTest(pbtest.PBSeleniumTest):
    """Verifies interaction with sites that use Service Worker caches"""

    def get_tab_data_url(self):
        """Returns the top-level frame URL for the first tab."""
        return self.js(
            "let tabData = chrome.extension.getBackgroundPage().badger.tabData;"
            "let min_tab_id = Math.min(...Object.keys(tabData));"
            "return tabData[min_tab_id].frames[0].host;"
        )

    def test_returning_to_sw_cached_page(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "service_workers.html"
        )

        # visit the Service Worker page to activate the worker
        self.load_url(FIXTURE_URL)

        # Service Workers are off by default in Firefox 60 ESR
        if not self.js("return 'serviceWorker' in navigator;"):
            self.skipTest("Service Workers are disabled")

        # wait for the worker to initialize its cache
        self.wait_for_script("return window.WORKER_READY;")

        # visit a different site (doesn't matter what it is,
        # just needs to be an http site with a different domain)
        self.load_url("https://dnt-test.trackersimulator.org/")

        # return to the SW page
        self.driver.back()

        # now open a new window (to avoid clearing badger.tabData)
        # and verify results
        self.open_window()
        self.load_url(self.options_url)
        url = self.get_tab_data_url()
        assert url == "efforg.github.io", "Unexpected first-tab URL in tabData"


if __name__ == "__main__":
    unittest.main()
