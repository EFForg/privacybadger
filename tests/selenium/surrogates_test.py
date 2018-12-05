#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest

from selenium.common.exceptions import TimeoutException

from pbtest import retry_until


class SurrogatesTest(pbtest.PBSeleniumTest):
    """Integration tests to verify surrogate script functionality."""

    # TODO update to pbtest.org URL
    # TODO and remove the HTML pages from eff.org then
    TEST_URL = "https://www.eff.org/files/pbtest/ga_js_surrogate_test.html"

    def load_ga_js_test_page(self, timeout=12):
        self.load_url(SurrogatesTest.TEST_URL)
        try:
            self.wait_for_and_switch_to_frame('iframe', timeout=timeout)
            self.wait_for_text('h1', "It worked!", timeout=timeout)
            return True
        except TimeoutException:
            return False

    def test_ga_js_surrogate(self):
        # verify the surrogate is present
        self.load_url(self.options_url)
        self.assertTrue(self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            "return sdb.hostnames.hasOwnProperty('www.google-analytics.com');"
        ), "Surrogate is missing but should be present.")

        # verify site loads
        self.assertTrue(
            self.load_ga_js_test_page(),
            "Page failed to load even before we did anything."
        )

        # block ga.js (known to break the site)
        self.load_url(self.options_url)
        # also back up the surrogate definition before removing it
        ga_backup = self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "bg.badger.heuristicBlocking.blacklistOrigin('www.google-analytics.com', 'google-analytics.com');"
            "const sdb = bg.require('surrogatedb');"
            "return JSON.stringify(sdb.hostnames['www.google-analytics.com']);"
        )
        # now remove the surrogate
        self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            "delete sdb.hostnames['www.google-analytics.com'];"
        )

        # wait until this happens
        self.wait_for_script(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            "return !sdb.hostnames.hasOwnProperty('www.google-analytics.com');",
            timeout=5,
            message="Timed out waiting for surrogate to get removed."
        )

        # verify site breaks
        self.assertFalse(
            self.load_ga_js_test_page(),
            "Page loaded successfully when it should have failed."
        )

        # re-enable surrogate
        self.load_url(self.options_url)
        self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            "sdb.hostnames['www.google-analytics.com'] = JSON.parse('%s');" % ga_backup
        )

        # wait until this happens
        self.wait_for_script(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            "return sdb.hostnames.hasOwnProperty('www.google-analytics.com');",
            timeout=5,
            message="Timed out waiting for surrogate to get readded."
        )

        # verify site loads again
        self.assertTrue(
            retry_until(self.load_ga_js_test_page),
            "Page failed to load after surrogation."
        )


if __name__ == "__main__":
    unittest.main()
