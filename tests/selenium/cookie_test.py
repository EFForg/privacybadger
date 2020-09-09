#!/usr/bin/env python
# -*- coding: UTF-8 -*-
import unittest

import pbtest
import window_utils

from popup_test import get_domain_slider_state


class CookieTest(pbtest.PBSeleniumTest):
    """Basic test to make sure the PB doesn't mess up with the cookies."""

    def assert_pass_opera_cookie_test(self, url, test_name):
        self.load_url(url)
        self.assertEqual("PASS", self.txt_by_css("#result"),
            "Cookie test failed: %s" % test_name)

    def test_should_pass_std_cookie_test(self):
        self.assert_pass_opera_cookie_test((
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "first_party_cookie.html"
        ), "Set 1st party cookie")

    def test_cookie_tracker_detection(self):
        """Tests basic cookie tracking. The tracking site has no DNT file,
        and gets blocked by PB.

        Visits three sites, all of which have an iframe that points to a fourth site
        that reads and writes a cookie. The third party cookie will be picked up by
        PB after each of the site loads, but no action will be taken. Then the first
        site will be reloaded, and the UI will show the third party domain as blocked."""

        SITE1_URL = "https://ddrybktjfxh4.cloudfront.net/"
        SITE2_URL = "https://d3syxqe9po5ji0.cloudfront.net/"
        SITE3_URL = "https://d3b37ucnz1m2l2.cloudfront.net/"

        THIRD_PARTY_DOMAIN = "efforg.github.io"

        self.wait_for_script("return typeof chrome != 'undefined' && chrome && chrome.extension")
        # remove pre-trained domains
        self.js(
            "chrome.extension.getBackgroundPage()."
            "badger.storage.clearTrackerData();"
        )

        # load the first site with the third party code that reads and writes a cookie
        self.load_url(SITE1_URL)
        self.load_pb_ui(SITE1_URL)
        # TODO it takes another visit (or a page reload)
        # TODO to show the domain as not-yet-blocked-but-tracking?
        #self.assertIn(THIRD_PARTY_DOMAIN, self.notYetBlocked)
        window_utils.close_window_with_url(self.driver, SITE1_URL)

        # go to second site
        self.load_url(SITE2_URL)
        self.load_pb_ui(SITE2_URL)
        self.assertIn(THIRD_PARTY_DOMAIN, self.notYetBlocked)
        window_utils.close_window_with_url(self.driver, SITE2_URL)

        # go to third site
        self.load_url(SITE3_URL)
        self.load_pb_ui(SITE3_URL)
        self.assertIn(THIRD_PARTY_DOMAIN, self.notYetBlocked)
        window_utils.close_window_with_url(self.driver, SITE3_URL)

        # revisiting the first site should cause
        # the third-party domain to be blocked
        self.load_url(SITE1_URL)
        self.load_pb_ui(SITE1_URL)
        self.assertIn(THIRD_PARTY_DOMAIN, self.blocked)

    def load_pb_ui(self, target_url):
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

        self.open_window()
        self.load_url(self.popup_url)

        # get the popup populated with status information for the correct url
        window_utils.switch_to_window_with_url(self.driver, self.popup_url)
        self.js("""
/**
 * if the query url pattern matches a tab, switch the module's tab object to that tab
 */
(function (url) {
  chrome.tabs.query({url}, function (tabs) {
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
      window.DONE_REFRESHING = true;
    });
  });
}(arguments[0]));""", target_url)

        # wait for popup to be ready
        self.wait_for_script(
            "return typeof window.DONE_REFRESHING != 'undefined' &&"
            "window.POPUP_INITIALIZED &&"
            "window.SLIDERS_DONE"
        )

        self.get_tracker_state()

    def get_tracker_state(self):
        """Parse the UI to group all third party origins into their respective action states."""
        self.notYetBlocked = {}
        self.cookieBlocked = {}
        self.blocked = {}

        self.driver.switch_to.window(self.driver.current_window_handle)

        domain_divs = self.driver.find_elements_by_css_selector(
            "#blockedResourcesInner > div.clicker[data-origin]")
        for div in domain_divs:
            origin = div.get_attribute('data-origin')

            # assert that this origin is never duplicated in the UI
            self.assertNotIn(origin, self.notYetBlocked)
            self.assertNotIn(origin, self.cookieBlocked)
            self.assertNotIn(origin, self.blocked)

            # get slider state for given origin
            action_type = get_domain_slider_state(self.driver, origin)

            # non-tracking domains are hidden by default
            # so if we see a slider set to "allow",
            # it must be in the tracking-but-not-yet-blocked section
            if action_type == 'allow':
                self.notYetBlocked[origin] = True
            elif action_type == 'cookieblock':
                self.cookieBlocked[origin] = True
            elif action_type == 'block':
                self.blocked[origin] = True
            else:
                self.fail("what is this?!? %s" % action_type)


if __name__ == "__main__":
    unittest.main()
