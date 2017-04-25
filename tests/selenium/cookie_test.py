#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
import time

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import window_utils

SITE1_URL = "http://eff-tracker-site1-test.s3-website-us-west-2.amazonaws.com"
SITE2_URL = "http://eff-tracker-site2-test.s3-website-us-west-2.amazonaws.com"
SITE3_URL = "http://eff-tracker-site3-test.s3-website-us-west-2.amazonaws.com"

THIRD_PARTY_TRACKER = "eff-tracker-test.s3-website-us-west-2.amazonaws.com"


class CookieTest(pbtest.PBSeleniumTest):
    """Basic test to make sure the PB doesn't mess up with the cookies."""

    def XXX_test_dnt_check_should_not_set_cookies(self):
        # TODO update to EFF URL
        TEST_DOMAIN = "localhost"
        TEST_URL = "https://{}/".format(TEST_DOMAIN)

        RUN_DNT_JS = """badger.checkForDNTPolicy(
  '{}', 0, r => window.DNT_CHECK_RESULT = r
);""".format(TEST_DOMAIN)
        CHECK_FINISHED_JS = "return window.DNT_CHECK_RESULT === false"

        # verify that the domain itself doesn't set cookies
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "No cookies initially")

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")

        # verify we got a cookie
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "DNT policy URL set a cookie")

        # clear cookies and verify
        self.driver.delete_all_cookies()
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "No cookies again")

        # perform a DNT policy check
        self.load_url(self.bg_url, wait_on_site=1)
        self.js(RUN_DNT_JS)
        # wait until checkForDNTPolicy completed
        self.wait_for_script(CHECK_FINISHED_JS)

        # check that we didn't get cookied by the DNT URL
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "Shouldn't have any cookies after the DNT check")

    def assert_pass_opera_cookie_test(self, url, test_name):
        self.load_url(url)
        self.assertEqual(
            "PASS",
            self.js("return document.getElementById('result').innerHTML"),
            "Cookie test failed: %s" % test_name)

    def test_should_pass_std_cookie_test(self):
        self.assert_pass_opera_cookie_test("https://gistcdn.githack.com/gunesacar/79aa14bac95694d38425d458843dacd6/raw/3d17cc07e071a45c0bf536b907b6848786090c8a/cookie.html",  # noqa
                                           "Set 1st party cookie")

    def test_cookie_tracker_detection(self):
        """Tests basic cookie tracking. The tracking site has no DNT file,
        and gets blocked by PB.

        Visits three sites, all of which have an iframe that points to a fourth site
        that reads and writes a cookie. The third party cookie will be picked up by
        PB after each of the site loads, but no action will be taken. Then the first
        site will be reloaded, and the UI will show the third party cookie as blocked."""

        self.driver.delete_all_cookies()
        # fixme: check for chrome settings for third party cookies?

        # load the first site with the third party code that reads and writes a cookie
        self.load_url(SITE1_URL)
        self.load_pb_ui(SITE1_URL)
        self.get_tracker_state()
        self.assertTrue(THIRD_PARTY_TRACKER in self.nonTrackers)

        # go to second site
        self.load_url(SITE2_URL)
        window_utils.close_windows_with_url(self.driver, SITE1_URL)
        self.load_pb_ui(SITE2_URL)
        self.get_tracker_state()
        self.assertTrue(THIRD_PARTY_TRACKER in self.nonTrackers)

        # go to third site
        self.load_url(SITE3_URL)
        window_utils.close_windows_with_url(self.driver, SITE2_URL)
        self.load_pb_ui(SITE3_URL)
        self.get_tracker_state()
        self.assertTrue(THIRD_PARTY_TRACKER in self.nonTrackers)

        # reloading the first site should now cause the cookie to be blocked
        # it can take a long time for the UI to be updated, so retry a number of
        # times before giving up. See bug #702.
        print("this is checking for a dnt file at a site without https, so we'll just have to wait for the connection to timeout before we proceed")
        self.load_url(SITE1_URL)
        window_utils.close_windows_with_url(self.driver, SITE3_URL)
        for i in range(60):
            self.load_pb_ui(SITE1_URL)
            self.get_tracker_state()

            if THIRD_PARTY_TRACKER in self.cookieBlocked:
                print("Popup UI has been updated. Yay!")
                break
            window_utils.close_windows_with_url(self.driver, self.popup_url)
            print("popup UI has not been updated yet. try again in 10 seconds")
            time.sleep(10)

        self.assertTrue(THIRD_PARTY_TRACKER in self.cookieBlocked)

    def load_pb_ui(self, target_scheme_and_host):
        """Show the PB popup as a new tab.

        If Selenium would let us just programmatically launch an extension from its icon,
        we wouldn't need this method. Alas it will not.

        But! We can open a new tab and set the url to the extension's popup html page and
        test away. That's how most devs test extensions. But**2!! PB's popup code uses
        the current tab's url to report the current tracker status.  And since we changed
        the current tab's url when we loaded the popup as a tab, the popup loses all the
        blocker status information from the original tab.

        The workaround is to execute a new convenience function in the popup codebase that
        looks for a given url in the tabs and, if it finds a match, refreshes the popup
        with the associated tabid. Then the correct status information will be displayed
        in the popup."""

        # open new tab with the PB UI
        # note: there's a selenium + chromedriver + mac bug where you can't use the command key to
        # open a new tab. And if you inject javascript to open a window and you have the
        # popup blocker turned on, it won't work. Workaround: embed a button on the target page
        # that opens a new window when clicked.
        window_utils.switch_to_window_with_url(self.driver, target_scheme_and_host)
        button = self.driver.find_element_by_id("newwindowbutton")
        button.click()
        window_utils.switch_to_window_with_url(self.driver, "about:blank")
        self.load_url(self.popup_url)

        # use the new convenience function to get the popup populated with status information for the correct url
        window_utils.switch_to_window_with_url(self.driver, self.popup_url)
        target_url = target_scheme_and_host + "/*"
        javascript_src = "setTabToUrl('" + target_url + "');"
        self.js(javascript_src)

    def get_tracker_state(self):
        """Parse the UI to group all third party origins into their respective action states."""
        self.nonTrackers = {}
        self.cookieBlocked = {}
        self.blocked = {}
        try:
            clickerContainer = self.driver.find_element_by_class_name("clickerContainer")
            self.assertTrue(clickerContainer)
        except:
            print("no action state information was found")
            return

        tooltips = clickerContainer.find_elements_by_xpath("//*[contains(@class,'clicker tooltip')]")
        for t in tooltips:
            origin = t.get_attribute('data-origin')

            # assert that this origin is never duplicated in the UI
            self.assertTrue(origin not in self.nonTrackers)
            self.assertTrue(origin not in self.cookieBlocked)
            self.assertTrue(origin not in self.blocked)

            action_type = t.get_attribute('data-original-action')
            if action_type == 'allow':
                self.nonTrackers[origin] = True
            elif action_type == 'noaction':
                self.nonTrackers[origin] = True
            elif action_type == 'cookieblock':
                self.cookieBlocked[origin] = True
            elif action_type == 'block':
                self.blocked[origin] = True
            else:
                print("what is this?!? " + str(action_type))
                self.assertTrue(False)


if __name__ == "__main__":
    unittest.main()
