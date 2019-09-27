#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest


class ServiceWorkersTest(pbtest.PBSeleniumTest):
    """Verifies interaction with sites that use Service Worker caches"""

    def get_tab_data_domains(self):
        domains = self.js(
            "let tabData = chrome.extension.getBackgroundPage().badger.tabData;"
            "return (Object.keys(tabData).map(tab_id => {"
            "  return tabData[tab_id].frames[0].host;"
            "}));"
        )
        return domains

    def test_returning_to_sw_cached_page(self):
        FIXTURE_URL = "https://www.eff.org/files/badger_test_fixtures/service_workers.html"

        # visit the Service Worker page to activate the worker
        self.load_url(FIXTURE_URL)
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
        self.assertIn("www.eff.org", domains,
            "SW page URL was not correctly attributed")
        self.assertEqual(len(domains), 1,
            "tabData contains an unexpected number of entries")


if __name__ == "__main__":
    unittest.main()
