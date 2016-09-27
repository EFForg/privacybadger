#!/usr/bin/env python
# -*- coding: UTF-8 -*-

from __future__ import unicode_literals

import unittest
import pbtest

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
        text = self.txt_by_css('p.page-instruction')
        return (
            "Encuentra tu reserva mediante una de las "
            "opciones que se muestran a continuación"
        ) in text

    # verify site loads
    def test_should_load_avianca_checkin_page(self):
        self.assertTrue(self.load_avianca_checkin_page())

    # TODO configure to block the hostname known to break the site
    # TODO load that site without surrogate
    # TODO verify site is broken
    # TODO reload with surrogate
    # TODO verify site is fixed


if __name__ == "__main__":
    unittest.main()
