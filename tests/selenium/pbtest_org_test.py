#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import pbtest
import unittest

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# where to run the acceptance tests
PBTEST_ORG_URL = "https://pbtest.org/tracker"

# the id of the element where test results are reported
PBTEST_ORG_TEST_RESULTS_TABLE_ID = "results"

# unicode characters we look in the results to tell if a test passed or failed
PASS = u'Pass'
FAIL = u'Fail'


class PBTestDotOrgTest(pbtest.PBSeleniumTest):
    """Run the pbtest.org website acceptance tests. Loads the pbtest.org test
       suite and assert that none of the tests failed or are 'undefined'."""

    @unittest.skip("Until we understand and fix the intermittent pbtest.org failures.")
    #@pbtest.repeat_if_failed(5) # TODO doesn't work with unittest.skip above
    def test_should_pass_pbtest_org_suite(self):
        driver = self.driver
        driver.delete_all_cookies()
        results = {'passed': [], 'failed': [], 'undefined': []}
        self.load_url(PBTEST_ORG_URL)
        WebDriverWait(driver, 100).until(
            EC.presence_of_element_located((
                By.XPATH,
                "//*[@id='buttons'][contains(@style, 'display: block')]")))
        for el in driver.find_elements_by_class_name('complimentary_text'):
            if not el.is_displayed():
                continue

            test_text = el.find_element_by_xpath('../..').text
            if PASS in el.text:
                results['passed'].append(test_text)
            elif FAIL in el.text:
                results['failed'].append(test_text)
            elif u'undefined' in el.text:
                results['undefined'].append(test_text)
            else:
                raise ValueError("Malformed test result")

        # now we have all the completed test results.
        # print a summary
        print("\npbtest_org test results: %d passed, %d failed, %d undefined" %
              (len(results['passed']), len(results['failed']),
               len(results['undefined'])))
        failed_tests = ([t for t in results['failed']] +
                        [t for t in results['undefined']])

        firefox_failures = [u'Does Privacy Badger Honor the Cookie Block List \u2717 Fail']
        # ignore this failure on firefox
        if pbtest.shim.browser_type == 'firefox' and failed_tests == firefox_failures:
            return

        fail_msg = "%d tests failed:\n  * %s" % (
            len(failed_tests),
            "\n  * ".join(failed_tests).replace(u'\u2717', 'x'),
        )
        self.assertTrue(len(failed_tests) == 0, msg=fail_msg)

if __name__ == "__main__":
    unittest.main()
