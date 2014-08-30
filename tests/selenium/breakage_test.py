#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
from time import sleep


class Test(pbtest.PBSeleniumTest):

    def test_should_load_eff_org(self):
        self.driver.get("https://www.eff.org")
        self.assertIn("Electronic Frontier Foundation", self.driver.title)

    def test_should_search_google(self):
        self.driver.get("https://www.google.com/")
        qry_el = self.driver.find_element_by_name("q")
        qry_el.send_keys("EFF")  # search term
        self.driver.find_element_by_name("btnG").click()
        sleep(5)  # give time to load the results and update the title
        self.assertIn("EFF", self.driver.title)


if __name__ == "__main__":
    unittest.main()
