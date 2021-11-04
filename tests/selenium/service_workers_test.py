#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import pytest
import unittest

import pbtest


class ServiceWorkersTest(pbtest.PBSeleniumTest):
    """Verifies interaction with sites that use Service Worker caches."""

    def get_tab_data_domains(self):
        domains = self.js(
            "let tabData = chrome.extension.getBackgroundPage().badger.tabData;"
            "return (Object.keys(tabData).map(tab_id => {"
            "  return tabData[tab_id].frames[0].host;"
            "}));"
        )
        return domains

    @pytest.mark.flaky(reruns=3, condition=pbtest.shim.browser_type == "firefox")
    def test_navigating_to_sw_cached_page(self):
        FIXTURE_HOST = "efforg.github.io"
        FIXTURE_URL = (
            "https://" + FIXTURE_HOST + "/privacybadger-test-fixtures/html/"
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
        domains = self.get_tab_data_domains()
        assert domains == [FIXTURE_HOST], (
            "tab URL for SW-cached page was incorrectly determined")

    def test_blocking_sw_requests(self):
        FIXTURE_HOST = "efforg.github.io"
        FIXTURE_URL = (
            "https://" + FIXTURE_HOST + "/privacybadger-test-fixtures/html/"
            "service_workers.html"
        )
        THIRD_PARTY_DOMAIN = "privacybadger-tests.eff.org"
        STATUS_SEL = "#third-party-load-result"

        # block the third-party domain
        self.block_domain(THIRD_PARTY_DOMAIN)

        # visit the Service Worker fixture
        self.load_url(FIXTURE_URL)

        # Service Workers are off by default in Firefox 60 ESR
        if not self.js("return 'serviceWorker' in navigator;"):
            self.skipTest("Service Workers are disabled")

        # confirm we blocked the third-party resource
        self.wait_for_nonempty_text(STATUS_SEL)
        status_el = self.driver.find_element_by_css_selector(STATUS_SEL)
        assert status_el.text == "error", "script should've been blocked"

        # wait for SW to complete installation
        self.wait_for_script("return window.WORKER_READY;")

        # reload the page
        self.driver.refresh()

        # confirm we still blocked the third-party resource
        self.wait_for_nonempty_text(STATUS_SEL)
        status_el = self.driver.find_element_by_css_selector(STATUS_SEL)
        assert status_el.text == "error", "script should've been blocked"

        # add the SW page domain to the site allowlist
        self.disable_badger_on_site(FIXTURE_HOST)

        # confirm we no longer block the third-party resource
        self.load_url(FIXTURE_URL)
        self.wait_for_nonempty_text(STATUS_SEL)
        status_el = self.driver.find_element_by_css_selector(STATUS_SEL)
        assert status_el.text == "success", "script should have loaded"


if __name__ == "__main__":
    unittest.main()
