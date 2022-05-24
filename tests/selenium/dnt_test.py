#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import json
import unittest

import pbtest

from functools import partial

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By

from pbtest import retry_until


class DntTest(pbtest.PBSeleniumTest):
    """Tests to make sure DNT policy checking works as expected."""

    CHECK_FOR_DNT_POLICY_JS = (
        "chrome.extension.getBackgroundPage()."
        "badger.checkForDNTPolicy("
        "  arguments[0],"
        "  r => window.DNT_CHECK_RESULT = r"
        ");"
    )

    # TODO switch to non-delayed version
    # https://gist.github.com/ghostwords/9fc6900566a2f93edd8e4a1e48bbaa28
    # once race condition (https://crbug.com/478183) is fixed
    NAVIGATOR_DNT_TEST_URL = (
        "https://efforg.github.io/privacybadger-test-fixtures/html/"
        "navigator_donottrack_delayed.html"
    )

    def get_first_party_headers(self, url):
        self.load_url(url)

        text = self.driver.find_element(By.TAG_NAME, 'body').text

        try:
            headers = json.loads(text)['headers']
        except ValueError:
            print(f"\nFailed to parse JSON from {repr(text)}")
            return None

        return headers

    def test_dnt_policy_check_should_happen_for_blocked_domains(self):
        PAGE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "dnt.html"
        )
        DNT_DOMAIN = "www.eff.org"

        # mark a DNT-compliant domain for blocking
        self.block_domain(DNT_DOMAIN)

        # visit a page that loads a resource from that DNT-compliant domain
        self.load_url(PAGE_URL)

        # verify that the domain is blocked
        self.open_popup(PAGE_URL)
        assert self.get_domain_slider_state(DNT_DOMAIN) == "block", (
            "DNT-compliant resource should have been blocked at first")

        def reload_and_see_if_unblocked():
            # switch back to the page with the DNT-compliant resource
            self.switch_to_window_with_url(PAGE_URL)

            # reload it
            self.load_url(PAGE_URL)

            self.open_popup(PAGE_URL)
            return self.get_domain_slider_state(DNT_DOMAIN) == "block"

        # verify that the domain is allowed
        was_blocked = retry_until(
            reload_and_see_if_unblocked,
            tester=lambda x: not x,
            msg="Waiting a bit for DNT check to complete and retrying ...")

        assert not was_blocked, (
            "DNT-compliant resource should have gotten unblocked")

    def test_dnt_policy_check_should_not_set_cookies(self):
        TEST_DOMAIN = "dnt-test.trackersimulator.org"
        TEST_URL = f"https://{TEST_DOMAIN}/"

        # verify that the domain itself doesn't set cookies
        self.load_url(TEST_URL)
        assert not self.driver.get_cookies(), "Expect no cookies at first"

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")
        assert len(self.driver.get_cookies()) == 1, (
            "DNT policy URL should have set a cookie")

        # verify we got a cookie
        self.load_url(TEST_URL)
        assert len(self.driver.get_cookies()) == 1, "Should still have one cookie"

        # clear cookies and verify
        self.driver.delete_all_cookies()
        self.load_url(TEST_URL)
        assert not self.driver.get_cookies(), "Should have no cookies again"

        self.load_url(self.options_url)
        # perform a DNT policy check
        self.js(DntTest.CHECK_FOR_DNT_POLICY_JS, TEST_DOMAIN)
        # wait until checkForDNTPolicy completed
        self.wait_for_script("return window.DNT_CHECK_RESULT === false")

        # check that we didn't get cookied by the DNT URL
        self.load_url(TEST_URL)
        assert not self.driver.get_cookies(), (
            "Shouldn't have any cookies after the DNT check")

    def test_dnt_policy_check_should_not_send_cookies(self):
        TEST_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        TEST_URL = f"https://{TEST_DOMAIN}/"

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")
        assert len(self.driver.get_cookies()) == 1, (
            "DNT policy URL should have set a cookie")

        # how to check we didn't send a cookie along with request?
        # the DNT policy URL used by this test returns "cookies=X"
        # where X is the number of cookies it got
        # MEGAHACK: make sha1 of "cookies=0" a valid DNT hash
        self.load_url(self.options_url)
        self.js(
            "chrome.extension.getBackgroundPage()."
            "badger.storage.updateDntHashes({"
            "  'cookies=0 test policy': 'f63ee614ebd77f8634b92633c6bb809a64b9a3d7'"
            "});"
        )

        # perform a DNT policy check
        self.js(DntTest.CHECK_FOR_DNT_POLICY_JS, TEST_DOMAIN)
        # wait until checkForDNTPolicy completed
        self.wait_for_script("return typeof window.DNT_CHECK_RESULT != 'undefined';")
        # get the result
        result = self.js("return window.DNT_CHECK_RESULT;")
        assert result, "No cookies were sent"

    def test_should_not_record_nontracking_domains(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "recording_nontracking_domains.html"
        )
        TRACKING_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        NON_TRACKING_DOMAIN = "www.eff.org"

        # clear pre-trained/seed tracker data
        self.clear_tracker_data()

        # enable local learning
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

        # visit a page containing two third-party resources,
        # one from a cookie-tracking domain
        # and one from a non-tracking domain
        self.load_url(FIXTURE_URL)

        # verify both domains are present on the page
        try:
            selector = f"iframe[src*='{TRACKING_DOMAIN}']"
            self.driver.find_element(By.CSS_SELECTOR, selector)
        except NoSuchElementException:
            self.fail("Unable to find the tracking domain on the page")
        try:
            selector = f"img[src*='{NON_TRACKING_DOMAIN}']"
            self.driver.find_element(By.CSS_SELECTOR, selector)
        except NoSuchElementException:
            self.fail("Unable to find the non-tracking domain on the page")

        action_map = self.get_badger_storage('action_map')

        # verify that the cookie-tracking domain was recorded
        assert TRACKING_DOMAIN in action_map, (
            "Tracking domain should have gotten recorded")

        # verify that the non-tracking domain was not recorded
        assert NON_TRACKING_DOMAIN not in action_map, (
            "Non-tracking domain should not have gotten recorded")

    def test_first_party_dnt_header(self):
        TEST_URL = "https://httpbin.org/get"
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        assert headers is not None, "It seems we failed to get headers"
        assert 'Dnt' in headers, "DNT header should have been present"
        assert 'Sec-Gpc' in headers, "GPC header should have been present"
        assert headers['Dnt'] == "1", 'DNT header should have been set to "1"'
        assert headers['Sec-Gpc'] == "1", 'Sec-Gpc header should have been set to "1"'

    def test_no_dnt_header_when_disabled_on_site(self):
        TEST_URL = "https://httpbin.org/get"
        self.disable_badger_on_site(TEST_URL)
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        assert headers is not None, "It seems we failed to get headers"
        assert 'Dnt' not in headers, "DNT header should have been missing"
        assert 'Sec-Gpc' not in headers, "GPC header should have been missing"

    def test_no_dnt_header_when_dnt_disabled(self):
        TEST_URL = "https://httpbin.org/get"

        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#enable_dnt_checkbox').click()

        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        assert headers is not None, "It seems we failed to get headers"
        assert 'Dnt' not in headers, "DNT header should have been missing"
        assert 'Sec-Gpc' not in headers, "GPC header should have been missing"

    def test_navigator_object(self):
        self.load_url(DntTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)
        body_text = self.driver.find_element(By.TAG_NAME, 'body').text
        assert body_text == 'no tracking (navigator.doNotTrack="1")', (
            'navigator.DoNotTrack should have been set to "1"')
        assert self.js("return navigator.globalPrivacyControl === true"), (
            "navigator.globalPrivacyControl should have been set to true")

    def test_navigator_unmodified_when_disabled_on_site(self):
        self.disable_badger_on_site(DntTest.NAVIGATOR_DNT_TEST_URL)

        self.load_url(DntTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)

        # navigator.doNotTrack defaults to null in Chrome, "unspecified" in Firefox
        body_text = self.driver.find_element(By.TAG_NAME, 'body').text
        assert body_text[0:5] == 'unset', (
            "navigator.DoNotTrack should have been left unset")
        assert self.js("return typeof navigator.globalPrivacyControl == 'undefined'"), (
            "navigator.globalPrivacyControl should have been left unset")

    def test_navigator_unmodified_when_dnt_disabled(self):
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#enable_dnt_checkbox').click()

        self.load_url(DntTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)

        # navigator.doNotTrack defaults to null in Chrome, "unspecified" in Firefox
        body_text = self.driver.find_element(By.TAG_NAME, 'body').text
        assert body_text[0:5] == 'unset', (
            "navigator.DoNotTrack should have been left unset")
        assert self.js("return typeof navigator.globalPrivacyControl == 'undefined'"), (
            "navigator.globalPrivacyControl should have been left unset")


if __name__ == "__main__":
    unittest.main()
