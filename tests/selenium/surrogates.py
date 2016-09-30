#!/usr/bin/env python
# -*- coding: UTF-8 -*-

from __future__ import unicode_literals

import unittest
import pbtest

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


# TODO move to eff.org: https://github.com/EFForg/privacybadgerchrome/issues/928
class Test(pbtest.PBSeleniumTest):
    """Integration tests to verify surrogate script functionality."""

    def load_avianca_checkin_page(self):
        self.load_url("http://checkin.avianca.com/")
        WebDriverWait(self.driver, pbtest.SEL_DEFAULT_WAIT_TIMEOUT).until(
            EC.frame_to_be_available_and_switch_to_it((By.TAG_NAME, 'iframe'))
        )
        try:
            return WebDriverWait(self.driver, pbtest.SEL_DEFAULT_WAIT_TIMEOUT).until(
                EC.text_to_be_present_in_element(
                    (By.CSS_SELECTOR, 'p.page-instruction'),
                    (
                        "Encuentra tu reserva mediante una de las "
                        "opciones que se muestran a continuación"
                    )
                )
            )
        except TimeoutException:
            return False

    def test_avianca(self):
        # verify site loads
        self.assertTrue(self.load_avianca_checkin_page())

        # open and switch to a new window to avoid the beforeunload dialog
        self.open_window()

        # block ga.js (known to break the site)
        self.load_url(pbtest.PB_CHROME_BG_URL, wait_on_site=1)
        ga_backup = self.js(
            "pb.saveAction('block', 'www.google-analytics.com');"
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
        self.assertFalse(self.load_avianca_checkin_page())

        # switch back to PB's background page
        self.driver.switch_to_window(self.driver.window_handles[-2])

        # re-enable surrogate
        self.js(
            "const sdb = require('surrogatedb');"
            "sdb.hostnames['www.google-analytics.com'] = JSON.parse('%s');" % ga_backup
        )

        # still need to keep PB's bg page open ...
        self.open_window()

        # verify site loads again
        self.assertTrue(self.load_avianca_checkin_page())


if __name__ == "__main__":
    unittest.main()
