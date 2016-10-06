#!/usr/bin/env python
# -*- coding: UTF-8 -*-

from __future__ import unicode_literals

import unittest
import pbtest

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from window_utils import switch_to_window_with_url


WAIT_TIMEOUT = 5


class Test(pbtest.PBSeleniumTest):
    """Integration tests to verify surrogate script functionality."""

    def load_ga_js_test_page(self):
        # TODO update to pbtest.org URL
        # TODO and remove the HTML pages from eff.org then
        self.load_url("https://www.eff.org/files/pbtest/ga_js_surrogate_test.html")
        wait = WebDriverWait(self.driver, WAIT_TIMEOUT)
        wait.until(
            EC.frame_to_be_available_and_switch_to_it((By.TAG_NAME, 'iframe'))
        )
        try:
            return wait.until(EC.text_to_be_present_in_element(
                (By.CSS_SELECTOR, 'h1'), "It worked!"
            ))
        except TimeoutException:
            return False

    def test_ga_js_surrogate(self):
        # verify site loads
        self.assertTrue(self.load_ga_js_test_page())

        # block ga.js (known to break the site)
        self.load_url(pbtest.PB_CHROME_BG_URL, wait_on_site=1)
        ga_backup = self.js(
            "badger.saveAction('block', 'www.google-analytics.com');"
            "const sdb = require('surrogatedb');"
            "return JSON.stringify(sdb.hostnames['www.google-analytics.com']);"
        )
        # and disable surrogate
        self.js(
            "const sdb = require('surrogatedb');"
            "delete sdb.hostnames['www.google-analytics.com'];"
        )

        # need to keep PB's background page open for our changes to persist ...
        # so, open and switch to a new window
        self.open_window()

        # verify site breaks
        self.assertFalse(self.load_ga_js_test_page())

        # switch back to PB's background page
        switch_to_window_with_url(self.driver, pbtest.PB_CHROME_BG_URL)

        # re-enable surrogate
        self.js(
            "const sdb = require('surrogatedb');"
            "sdb.hostnames['www.google-analytics.com'] = JSON.parse('%s');" % ga_backup
        )

        # still need to keep PB's bg page open ...
        self.open_window()

        # verify site loads again
        self.assertTrue(self.load_ga_js_test_page())


if __name__ == "__main__":
    unittest.main()
