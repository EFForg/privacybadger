#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pytest

import pbtest


class ServiceWorkersTest(pbtest.PBSeleniumTest):
    """Verifies interaction with sites that use Service Worker caches"""

    FIXTURE_URL = (
        "https://efforg.github.io/privacybadger-test-fixtures/html/"
        "service_workers.html"
    )
    FIXTURE_HOST = "efforg.github.io"
    THIRD_PARTY_HOST = "privacybadger-tests.eff.org"

    def get_tab_data_host(self):
        """Returns the top-level frame URL for the first tab."""
        return self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({ type: 'getTabData' }, tabData => {"
            "  let min_tab_id = Math.min(...Object.keys(tabData));"
            "  done(tabData[min_tab_id].frames[0].host);"
            "});")

    def init_sw_page(self):
        # visit the Service Worker page to activate the worker
        self.load_url(self.FIXTURE_URL)

        # Service Workers are off by default in Firefox 60 ESR
        if not self.js("return 'serviceWorker' in navigator;"):
            self.skipTest("Service Workers are disabled")

        # wait for the worker to initialize its cache
        self.wait_for_script("return window.WORKER_READY;")

        # visit a different site (doesn't matter what it is,
        # just needs to be an http site with a different domain)
        self.load_url("https://dnt-test.trackersimulator.org/")

    def test_returning_to_sw_cached_page(self):
        self.init_sw_page()

        # return to the SW page
        self.driver.back()

        # open a new window (to avoid clearing badger.tabData)
        # and verify results
        self.open_window()
        self.load_url(self.options_url)
        url = self.get_tab_data_host()
        assert url == self.FIXTURE_HOST, (
            "Unexpected first-tab hostname in tabData")

    # TODO FIXME
    @pytest.mark.xfail(pbtest.shim.browser_type in ("chrome", "edge"),
        reason="SW-initiated requests in Chromium have tabId of -1 and are currently ignored")
    def test_blocking_sw_initiated_requests(self):
        self.clear_tracker_data()
        self.block_domain(self.THIRD_PARTY_HOST)

        self.init_sw_page()

        self.load_url(self.FIXTURE_URL)

        # check what happened
        selector = '#third-party-load-result'
        self.wait_for_script(
            "return document.querySelector(arguments[0]).textContent",
            selector)
        assert self.find_el_by_css(selector).text == "error", (
            "third-party should have gotten blocked")

        # also check the popup
        self.open_popup(self.FIXTURE_URL)
        sliders = self.get_tracker_state()
        assert self.THIRD_PARTY_HOST in sliders['blocked'], (
            "third-party should be reported as blocked")


if __name__ == "__main__":
    unittest.main()
