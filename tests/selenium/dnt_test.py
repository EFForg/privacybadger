#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import json
import time
import unittest

import pbtest

from functools import partial

from pbtest import retry_until
from window_utils import switch_to_window_with_url


class DNTTest(pbtest.PBSeleniumTest):
    """Tests to make sure DNT policy checking works as expected."""

    CHECK_FOR_DNT_POLICY_JS = (
        "chrome.extension.getBackgroundPage()."
        "badger.checkForDNTPolicy("
        "  arguments[0],"
        "  r => window.DNT_CHECK_RESULT = r"
        ");"
    )

    # TODO switch to non-delayed version (see below)
    # once race condition (https://crbug.com/478183) is fixed
    NAVIGATOR_DNT_TEST_URL = (
        "https://gitcdn.link/cdn/ghostwords/"
        "1c50869a0469e38d5dabd53f1204d3de/raw/c0ecc85bf452d5f1a410db700bc908306a9506fe/"
        "privacy-badger-navigator-donottrack-delayed-fixture.html"
        # non-delayed version:
        #"9fc6900566a2f93edd8e4a1e48bbaa28/raw/b7a6d9e70ce103da49e74ba239da4443fb514c2f/"
        #"privacy-badger-navigator-donottrack-fixture.html"
    )

    def get_first_party_headers(self, url):
        self.load_url(url)

        text = self.driver.find_element_by_tag_name('body').text

        try:
            headers = json.loads(text)['headers']
        except ValueError:
            print("\nFailed to parse JSON from {}".format(repr(text)))
            return None

        return headers

    def disable_badger_on_site(self, url):
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-whitelisted-domains"]').click()
        self.driver.find_element_by_id('newWhitelistDomain').send_keys(url)
        self.driver.find_element_by_css_selector('button.addButton').click()

    def domain_was_recorded(self, domain):
        return self.js(
            "return (Object.keys("
            "  chrome.extension.getBackgroundPage()."
            "  badger.storage.action_map.getItemClones()"
            ").indexOf(arguments[0]) != -1);",
            domain
        )

    def domain_was_detected(self, domain):
        return self.js(
            "return (Object.keys(chrome.extension.getBackgroundPage().badger.tabData).some(tab_id => {"
            "  let origins = chrome.extension.getBackgroundPage().badger.tabData[tab_id].origins;"
            "  return origins.hasOwnProperty(arguments[0]);"
            "}));",
            domain
        )

    def domain_was_blocked(self, domain):
        return self.js(
            "return (Object.keys(chrome.extension.getBackgroundPage().badger.tabData).some(tab_id => {"
            "  let origins = chrome.extension.getBackgroundPage().badger.tabData[tab_id].origins;"
            "  return ("
            "    origins.hasOwnProperty(arguments[0]) &&"
            "    chrome.extension.getBackgroundPage().constants.BLOCKED_ACTIONS.has(origins[arguments[0]])"
            "  );"
            "}));",
            domain
        )

    @pbtest.repeat_if_failed(3)
    def test_dnt_check_should_happen_for_blocked_domains(self):
        PAGE_URL = (
            "https://gitcdn.link/cdn/ghostwords/"
            "74585c942a918509b20bf2db5659646e/raw/2401659e678442de6309339882f19fbb21dbc959/"
            "privacy_badger_dnt_test_fixture.html"
        )
        DNT_DOMAIN = "www.eff.org"
        BLOCK_DOMAIN_JS = (
            "(function () {"
            "chrome.extension.getBackgroundPage()."
            "badger.storage.setupHeuristicAction("
            "  arguments[0],"
            "  chrome.extension.getBackgroundPage().constants.BLOCK"
            ");"
            "}());"
        )

        # mark a DNT-compliant domain for blocking
        self.load_url(self.options_url)
        self.js(BLOCK_DOMAIN_JS, DNT_DOMAIN)

        # visit a page that loads a resource from that DNT-compliant domain
        self.open_window()
        self.load_url(PAGE_URL)

        # switch back to Badger's options page
        switch_to_window_with_url(self.driver, self.options_url)

        # verify that the domain is blocked
        self.assertTrue(self.domain_was_detected(DNT_DOMAIN),
            msg="Domain should have been detected.")
        self.assertTrue(self.domain_was_blocked(DNT_DOMAIN),
            msg="DNT-compliant resource should have been blocked at first.")

        def reload_and_see_if_unblocked():
            # switch back to the page with the DNT-compliant resource
            switch_to_window_with_url(self.driver, PAGE_URL)

            # reload it
            self.load_url(PAGE_URL)

            # switch back to Badger's options page
            switch_to_window_with_url(self.driver, self.options_url)

            return (
                self.domain_was_detected(DNT_DOMAIN) and
                self.domain_was_blocked(DNT_DOMAIN)
            )

        # verify that the domain is allowed
        was_blocked = retry_until(
            reload_and_see_if_unblocked,
            tester=lambda x: not x,
            msg="Waiting a bit for DNT check to complete and retrying ...")

        self.assertFalse(was_blocked,
            msg="DNT-compliant resource should have gotten unblocked.")

    def test_dnt_check_should_not_set_cookies(self):
        TEST_DOMAIN = "dnt-test.trackersimulator.org"
        TEST_URL = "https://{}/".format(TEST_DOMAIN)

        # verify that the domain itself doesn't set cookies
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "No cookies initially")

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "DNT policy URL set a cookie")

        # verify we got a cookie
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "We still have just one cookie")

        # clear cookies and verify
        self.driver.delete_all_cookies()
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "No cookies again")

        self.load_url(self.options_url)
        # perform a DNT policy check
        self.js(DNTTest.CHECK_FOR_DNT_POLICY_JS, TEST_DOMAIN)
        # wait until checkForDNTPolicy completed
        self.wait_for_script("return window.DNT_CHECK_RESULT === false")

        # check that we didn't get cookied by the DNT URL
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "Shouldn't have any cookies after the DNT check")

    def test_dnt_check_should_not_send_cookies(self):
        TEST_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        TEST_URL = "https://{}/".format(TEST_DOMAIN)

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "DNT policy URL set a cookie")

        # how to check we didn't send a cookie along with request?
        # the DNT policy URL used by this test returns "cookies=X"
        # where X is the number of cookies it got
        # MEGAHACK: make sha1 of "cookies=0" a valid DNT hash
        self.load_url(self.options_url)
        # wait for DNT hash update to complete
        # so that it doesn't overwrite our change below
        # TODO wait conditionally; will be able to remove waiting here once
        # badger.INITIALIZED accounts for things that initialize async
        time.sleep(1)
        self.js(
            "chrome.extension.getBackgroundPage()."
            "badger.storage.updateDNTHashes({"
            "  'cookies=0 test policy': 'f63ee614ebd77f8634b92633c6bb809a64b9a3d7'"
            "});"
        )

        # perform a DNT policy check
        self.js(DNTTest.CHECK_FOR_DNT_POLICY_JS, TEST_DOMAIN)
        # wait until checkForDNTPolicy completed
        self.wait_for_script("return typeof window.DNT_CHECK_RESULT != 'undefined';")
        # get the result
        result = self.js("return window.DNT_CHECK_RESULT;")
        self.assertTrue(result, "No cookies were sent")

    def test_should_not_record_nontracking_domains(self):
        TEST_URL = (
            "https://gitcdn.link/cdn/ghostwords/"
            "eef2c982fc3151e60a78136ca263294d/raw/9f83f7ad9b7aa04484a9682b937dec7bcbfb7a6e/"
            "privacy_badger_recording_nontracking_domains_fixture.html"
        )
        TRACKING_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        NON_TRACKING_DOMAIN = "dnt-test.trackersimulator.org"

        # visit a page containing two third-party resources,
        # one from a cookie-tracking domain
        # and one from a non-tracking domain
        self.load_url(TEST_URL)

        self.load_url(self.options_url)

        # verify that the cookie-tracking domain was recorded
        self.assertTrue(
            self.domain_was_recorded(TRACKING_DOMAIN),
            "Tracking domain should have gotten recorded"
        )

        # verify that the non-tracking domain was not recorded
        self.assertFalse(
            self.domain_was_recorded(NON_TRACKING_DOMAIN),
            "Non-tracking domain should not have gotten recorded"
        )

    def test_first_party_dnt_header(self):
        TEST_URL = "https://httpbin.org/get"

        # wait until DNT-injecting webRequest listeners have been registered
        self.wait_for_script(
            "return chrome.extension.getBackgroundPage().badger.INITIALIZED"
        )

        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        self.assertTrue(headers is not None, "It seems we failed to get DNT headers")
        self.assertIn('Dnt', headers, "DNT header should have been present")
        self.assertEqual(headers['Dnt'], "1",
            'DNT header should have been set to "1"')

    def test_no_dnt_header_when_disabled(self):
        TEST_URL = "https://httpbin.org/get"
        self.disable_badger_on_site(TEST_URL)
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        self.assertTrue(headers is not None, "It seems we failed to get DNT headers")
        self.assertNotIn('Dnt', headers, "DNT header should have been missing")

    def test_navigator_object(self):
        self.load_url(DNTTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)

        self.assertEqual(
            self.driver.find_element_by_tag_name('body').text,
            'no tracking (navigator.doNotTrack="1")',
            "navigator.DoNotTrack should have been set to \"1\""
        )

    def test_navigator_left_alone_when_disabled(self):
        self.disable_badger_on_site(DNTTest.NAVIGATOR_DNT_TEST_URL)

        self.load_url(DNTTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)

        # navigator.doNotTrack defaults to null in Chrome, "unspecified" in Firefox
        self.assertEqual(
            self.driver.find_element_by_tag_name('body').text[0:5],
            'unset',
            "navigator.DoNotTrack should have been left unset"
        )


if __name__ == "__main__":
    unittest.main()
