#!/usr/bin/env python

import unittest

import pytest

import pbtest

from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class ServiceWorkersTest(pbtest.PBSeleniumTest):
    """Verifies interaction with sites that use Service Worker caches"""

    FIXTURE_URL = (
        "https://efforg.github.io/privacybadger-test-fixtures/html/"
        "service_workers.html"
    )
    FIXTURE_HOST = "efforg.github.io"
    THIRD_PARTY_HOST = "privacybadger-tests.eff.org"

    def get_first_tab_data(self):
        """Returns the top-level document's URL/host for the first tab."""
        tab_data = self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({ type: 'getTabData' }, tabData => {"
            "  let min_tab_id = Math.min(...Object.keys(tabData));"
            "  done(tabData[min_tab_id].frames[0]);"
            "});")
        return tab_data

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

        # open new window (to avoid clearing badger.tabData) and verify results
        self.open_window()
        self.load_url(self.options_url)
        tab_data = self.get_first_tab_data()
        assert tab_data['host'] == self.FIXTURE_HOST, (
            "Unexpected first-tab hostname in tabData")

    @pytest.mark.flaky(reruns=3)
    def test_redirect_to_sw_cached_page(self):
        self.init_sw_page()

        # visit a page that 302-redirects back to our fixture
        self.load_url("https://httpbin.org/redirect-to"
            "?url=https%3A%2F%2Fefforg.github.io%2Fprivacybadger-test-fixtures%2Fhtml%2Fservice_workers.html"
            "&status_code=302")

        # wait for URL to change
        WebDriverWait(self.driver, 10).until(EC.url_to_be(self.FIXTURE_URL))

        # open new window (to avoid clearing badger.tabData) and verify results
        self.open_window()
        self.load_url(self.options_url)
        tab_data = self.get_first_tab_data()
        assert tab_data['url'] == self.FIXTURE_URL, (
            "Unexpected first-tab URL in tabData")

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

    def test_disabling_on_site(self):
        self.clear_tracker_data()
        self.block_domain(self.THIRD_PARTY_HOST)

        self.init_sw_page()

        self.disable_badger_on_site(self.FIXTURE_HOST)

        self.load_url(self.FIXTURE_URL)

        # check what happened
        selector = '#third-party-load-result'
        self.wait_for_script(
            "return document.querySelector(arguments[0]).textContent",
            selector)
        assert self.find_el_by_css(selector).text == "success", (
            "third-party should have been allowed to load")


if __name__ == "__main__":
    unittest.main()
