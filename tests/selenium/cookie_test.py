#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest


class CookieTest(pbtest.PBSeleniumTest):
    """Basic test to make sure the PB doesn't mess up with the cookies."""

    def assert_pass_opera_cookie_test(self, url, test_name):
        self.driver.get(url)
        self.assertEqual("PASS",
             self.js("return document.getElementById('result').innerHTML"),
             "Cookie test failed: %s" % test_name)

    def test_should_pass_std_cookie_test(self):
        self.assert_pass_opera_cookie_test("http://jsbin.com/soluqi/1/",
                                           "Set 1st party cookie")


if __name__ == "__main__":
    unittest.main()
