#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class Test(pbtest.PBSeleniumTest):
    """Make sure we don't badly break things when we install the extension.
    e.g. we should be able to load a website, search on Google.
    TODO: Add other tests to simulate most common web use cases:
    e.g. play Youtube videos, login to popular services, tweet some text,
    add Reddit comments etc."""

    def test_should_load_eff_org(self):
        self.load_url("https://www.eff.org")
        WebDriverWait(self.driver, 10).until(EC.title_contains("Electronic Frontier Foundation"))

    def test_should_search_google(self):
        self.load_url("https://www.google.com/")
        qry_el = self.driver.find_element_by_name("q")
        qry_el.send_keys("EFF")  # search term
        qry_el.submit()
        WebDriverWait(self.driver, 10).until(EC.title_contains("EFF"))


if __name__ == "__main__":
    unittest.main()
