#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import pbtest
import sys
import time
import unittest

#import IPython

from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException, TimeoutException

# where to run the acceptance tests
PBTEST_ORG_URL = "https://pbtest.org/tracker"

# the id of the element where test results are reported
PBTEST_ORG_TEST_RESULTS_TABLE_ID = "results"

# the unicode characters we look for the the results to tell if a test passed or failed
PASS = u'\u2713'
FAIL = u'\u2717'

class PBTest_Org_test(pbtest.PBSeleniumTest):
    """Run the pbtest.org website acceptance tests. Loads the pbtest.org test suite and assert that
       none of the tests failed. Ignores tests with a status of "undefined" and any tests not
       visible to the user. """

    def test_should_pass_pbtest_org_suite(self):
        self.driver.delete_all_cookies()
        # possible fixme: check for chrome settings for third party cookies?

        # there's some chromedriver / welcome page weirdness where chromedriver
        # does not process all of the test ajax call responses because pb
        # immediately opens its first time welcome page in another tab.
        # the workaround is to load the pb page; let pb open the first time
        # page; switch to the first time page and close it; then go back
        # to the pb test page and reload the page again. 
        self.driver.get( PBTEST_ORG_URL )
        print("loaded window at %s" % ( PBTEST_ORG_URL))
        time.sleep(5)
        for w in self.driver.window_handles:
            self.driver.switch_to.window( w )
            if self.driver.current_url.startswith(u'chrome-extension://'):
                print("going to close window " + self.driver.current_url)
                self.driver.close()
        self.driver.switch_to.window( self.driver.window_handles[0] )
        self.driver.get( PBTEST_ORG_URL )

        # get a list of all the data rows in the table, and sort them according to their
        # current state: passed, failed, still_executing, or undefined. if they
        # aren't all executed, wait a few seconds and try again. Max tries is 10.
        tr_states = { 'passed':[], 'failed':[], 'still_executing':[], 'undefined': [] }
        for i in range(10):
            tr_states = { 'passed':[], 'failed':[], 'undefined': [], 'executing':[] }
            try:
                results_table = self.driver.find_element_by_id( PBTEST_ORG_TEST_RESULTS_TABLE_ID )
                # pull out all the rows in the results table
                all_trs = results_table.find_elements_by_tag_name("tr")
                for tr in all_trs:
                    # skip the rows with th elements
                    headers = tr.find_elements_by_tag_name("th")
                    if headers:
                            continue
                    # skip the rows that are not user-visible
                    if not tr.is_displayed():
                            print(tr.text + ": this is not displayed - ignore")
                            continue

                    # pull out the test label and test status from the row
                    (testname, teststatus) = tr.find_elements_by_tag_name("td")

                    # sort according to the test status
                    if PASS in teststatus.text:
                            #print(tr.text + ": test has passed")
                            tr_states['passed'].append( tr )
                    elif FAIL in teststatus.text:
                            tr_states['failed'].append( tr )
                            #print(tr.text + ": test has failed")
                    elif u'undefined' in teststatus.text:
                            tr_states['undefined'].append( tr )
                            #print(tr.text + ": test is undefined")
                    else:
                            #print(tr.text + ": test is executing")
                            tr_states['executing'].append( tr )

                # some tests are not finished yet. sleep a bit and try again.
                if tr_states['executing']:
                        print("test not all completed yet. try again")
                        time.sleep(5)
                        continue

            # handle the case where the elements haven't been added to the DOM yet with a retry
            except (NoSuchElementException, StaleElementReferenceException, ValueError):
                time.sleep(5)
                continue

            break

        # complain if all tests haven't completed by now
        self.assertTrue( len(tr_states['executing']) == 0, msg="Problem test results execution on the server side.")

        # now we have all the completed test results. complain about any failed tests.
        print("pbtest_org_test: %d tests passed, %d tests failed, %d tests undefined" % ( len(tr_states['passed']), len(tr_states['failed']), len(tr_states['undefined']) ))
        failed_tests = [t.text for t in tr_states['failed']]
        fail_msg = "%d tests failed: %s" % ( len(failed_tests), ", ".join(failed_tests) )
        self.assertTrue( len(failed_tests) == 0, msg=fail_msg  )

if __name__ == "__main__":
    unittest.main()
