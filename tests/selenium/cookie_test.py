#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest


class OperaCookieTest(pbtest.PBSeleniumTest):
    """Run "Positive functionality" tests from Opera cookie tests.

    http://testsuites.opera.com/cookies/
    """
    def assert_pass_opera_cookie_test(self, path, test_name):
        self.driver.get("http://testsuites.opera.com/cookies/%s" % path)
        self.assertEqual("PASS",
             self.js("return document.getElementsByTagName('p')[0].innerHTML"),
             "Opera cookie test failed: %s" % test_name)

    def test_should_pass_std_cookie_test(self):
        self.assert_pass_opera_cookie_test("001.php", "1. Standard Cookie")

    def test_should_pass_expires_delete_test(self):
        self.assert_pass_opera_cookie_test("003.php", "3. Expires/Delete")

    def test_should_pass_cookie_path_test(self):
        self.assert_pass_opera_cookie_test("004/004.php", "4. Path")

    def test_should_pass_max_cookie_size_test(self):
        self.assert_pass_opera_cookie_test("006.php", "6. Max Size")

    def test_should_pass_max_number_per_server_test(self):
        self.assert_pass_opera_cookie_test("007.php",
                                           "7. Max Number Per Server")

    def test_should_pass_update_cookie_test(self):
        self.assert_pass_opera_cookie_test("008.php", "8. Update")

    def test_should_pass_header_js_cookie_eq_test(self):
        self.assert_pass_opera_cookie_test("009.php",
                                        "9. Header/Javascript equivalence")

    def test_should_pass_cookie_encoding_test(self):
        self.assert_pass_opera_cookie_test("011.php", "11. Encoding ")

    def test_should_pass_cookie_order_test(self):
        self.assert_pass_opera_cookie_test("016.php", "16. Order")

    def test_should_pass_http_only_test(self):
        self.assert_pass_opera_cookie_test("017.php", "17. HttpOnly & XHR")


if __name__ == "__main__":
    unittest.main()
