#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
from selenium.common.exceptions import TimeoutException


class Test(pbtest.PBSeleniumTest):

    def test_run_qunit_tests(self):
        # First load a dummy URL to make sure the extension is activated.
        # Otherwise, we ran into a race condition where Qunit runs (& fails)
        # while chrome.extension is undefined.
        # Probably related to Chromium bugs 129181 & 132148
        self.load_url(self.bg_url)
        self.load_url(self.test_url)

        try:
            # this text appears when tests finish running
            _ = self.txt_by_css(
                "#qunit-testresult-display > span.total",
                timeout=120
            )
        except TimeoutException as exc:
            self.fail("Cannot find the results of QUnit tests %s" % exc)

        print("QUnit summary:")
        print(self.txt_by_css("#qunit-testresult-display"))

        failed_test_els = self.driver.find_elements_by_css_selector(
            ".fail .test-name"
        )
        fail_msg = "The following QUnit tests failed:\n  * {}".format(
            "\n  * ".join([el.text for el in failed_test_els])
        )

        self.assertTrue(len(failed_test_els) == 0, msg=fail_msg)

if __name__ == "__main__":
    unittest.main()
