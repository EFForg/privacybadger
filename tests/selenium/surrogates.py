#!/usr/bin/env python
# -*- coding: UTF-8 -*-

from __future__ import unicode_literals

import unittest
import pbtest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re


class Test(pbtest.PBSeleniumTest):
    """Integration tests to verify surrogate script functionality."""

    # TODO move to eff.org: https://github.com/EFForg/privacybadgerchrome/issues/928
    # verify site loads
    def test_should_load_avianca_checkin_page(self):
        self.load_url("http://checkin.avianca.com/")
        self.driver.switch_to.frame(
            self.driver.find_element_by_tag_name("iframe")
        )
        el = WebDriverWait(self.driver, 10).until(
            EC.visibility_of_element_located((By.CLASS_NAME, 'page-instruction'))
        )
        self.assertTrue((
            "Encuentra tu reserva mediante una de las "
            "opciones que se muestran a continuación"
        ) in el.text)

    # TODO configure to block the hostname known to break a site
    # TODO load that site without surrogate
    # TODO verify site is broken
    # TODO reload with surrogate
    # TODO verify site is fixed


if __name__ == "__main__":
    unittest.main()
