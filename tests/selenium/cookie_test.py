#!/usr/bin/env python
# -*- coding: UTF-8 -*-
import time
import unittest

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import pbtest
import window_utils

from popup_test import get_domain_slider_state

SITE1_URL = "http://eff-tracker-site1-test.s3-website-us-west-2.amazonaws.com"
SITE2_URL = "http://eff-tracker-site2-test.s3-website-us-west-2.amazonaws.com"
SITE3_URL = "http://eff-tracker-site3-test.s3-website-us-west-2.amazonaws.com"

THIRD_PARTY_TRACKER = "eff-tracker-test.s3-website-us-west-2.amazonaws.com"


class CookieTest(pbtest.PBSeleniumTest):
    """Basic test to make sure the PB doesn't mess up with the cookies."""

    def assert_pass_opera_cookie_test(self, url, test_name):
        self.load_url(url)
        self.assertEqual(
            "PASS",
            self.js("return document.getElementById('result').innerHTML"),
            "Cookie test failed: %s" % test_name)

    def test_should_pass_std_cookie_test(self):
        self.assert_pass_opera_cookie_test(
"""https://gistcdn.githack.com/gunesacar/79aa14bac95694d38425d458843dacd6/raw/3d17cc07e071a45c0bf536b907b6848786090c8a/cookie.html""",
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
        #
        # this is checking for a dnt file at a site without https, so we'll
        # just have to wait for the connection to time out before we proceed
        self.load_url(SITE1_URL)
        window_utils.close_windows_with_url(self.driver, SITE3_URL)
        for _ in range(5):
            self.load_pb_ui(SITE1_URL)
            self.get_tracker_state()

            if THIRD_PARTY_TRACKER in self.cookieBlocked:
                # Popup UI has been updated. Yay!
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
        button = self.find_el_by_css("#newwindowbutton")
        button.click()
        window_utils.switch_to_window_with_url(self.driver, "about:blank")
        self.load_url(self.popup_url)

        # get the popup populated with status information for the correct url
        window_utils.switch_to_window_with_url(self.driver, self.popup_url)
        target_url = target_scheme_and_host + "/*"
        javascript_src = """/**
 * if the query url pattern matches a tab, switch the module's tab object to that tab
 */
function setTabToUrl(query_url) {
  chrome.tabs.query({url: query_url}, function (tabs) {
    if (!tabs || !tabs.length) {
      return;
    }
    chrome.runtime.sendMessage({
      type: "getPopupData",
      tabId: tabs[0].id,
      tabUrl: tabs[0].url
    }, (response) => {
      setPopupData(response);
      refreshPopup();
    });
  });
}"""
        self.js(javascript_src + "setTabToUrl('{}');".format(target_url))

    def get_tracker_state(self):
        """Parse the UI to group all third party origins into their respective action states."""
        self.nonTrackers = {}
        self.cookieBlocked = {}
        self.blocked = {}
        self.driver.switch_to.window(self.driver.current_window_handle)

        # wait for asynchronously-rendered tracker list to load
        WebDriverWait(self.driver, 2).until(EC.presence_of_element_located(
            (By.CSS_SELECTOR,
             "#blockedResourcesInner > div.clicker[data-origin]")))
        domain_divs = self.driver.find_elements_by_css_selector("#blockedResourcesInner > div.clicker[data-origin]")
        for div in domain_divs:
            origin = div.get_attribute('data-origin')

            # assert that this origin is never duplicated in the UI
            self.assertTrue(origin not in self.nonTrackers)
            self.assertTrue(origin not in self.cookieBlocked)
            self.assertTrue(origin not in self.blocked)

            # get slider state for given origin
            action_type = get_domain_slider_state(self.driver, origin)

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
                self.assertTrue(False) # pylint: disable=redundant-unittest-assert


if __name__ == "__main__":
    unittest.main()
