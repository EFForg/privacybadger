#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest

PB_CHROME_QUNIT_TEST_URL = pbtest.PB_EXT_BG_URL_BASE + "tests/index.html"


class Test(pbtest.PBSeleniumTest):

    def test_run_qunit_tests(self):
        self.driver.get(PB_CHROME_QUNIT_TEST_URL)
        failed = self.txt_by_css("#qunit-testresult > span.failed")
        passed = self.txt_by_css("#qunit-testresult > span.passed")
        total = self.txt_by_css("#qunit-testresult > span.total")
        print "User agent:", self.txt_by_css("#qunit-userAgent")
        print "QUnits tests: Failed: %s Passed: %s Total: %s" %\
                                         (failed, passed, total)
        self.assertEqual("0", failed)
        # TODO: Report failed QUnit tests

if __name__ == "__main__":
    unittest.main()
