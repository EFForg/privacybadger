#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By


class QUnitTest(pbtest.PBSeleniumTest):

    def test_run_qunit_tests(self):
        self.load_url(self.test_url)

        try:
            # this text appears when tests finish running
            self.txt_by_css(
                "#qunit-testresult-display > span.total",
                timeout=120
            )
        except TimeoutException as exc:
            self.fail(f"Cannot find the results of QUnit tests {exc}")

        print("\nQUnit summary:")
        print(self.txt_by_css("#qunit-testresult-display"))

        failed_test_els = self.driver.find_elements(By.CSS_SELECTOR,
            ".fail .test-name")
        fail_msg = "The following QUnit tests failed:\n  * {}".format(
            "\n  * ".join([el.text for el in failed_test_els])
        )

        assert not failed_test_els, fail_msg


if __name__ == "__main__":
    unittest.main()
