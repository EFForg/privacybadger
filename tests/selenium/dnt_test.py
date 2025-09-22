#!/usr/bin/env python

import json
import unittest

import pytest

import pbtest

from functools import partial

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By

from pbtest import retry_until


class DntTest(pbtest.PBSeleniumTest):
    """Tests to make sure DNT policy checking works as expected."""

    def setUp(self):
        self.FIXTURE_DOMAIN = "efforg.github.io"
        self.FIXTURE_PARENT_DOMAIN = "github.io"
        self.FIXTURE_URL = (
            f"https://{self.FIXTURE_DOMAIN}/privacybadger-test-fixtures/html/")
        # TODO switch to scripting in Firefox (MV2) to remove delay
        # TODO https://github.com/EFForg/privacybadger/issues/2948
        self.FIXTURE_URL += "navigator_donottrack_delayed.html"

    def get_first_party_headers(self, url):
        self.load_url(url)

        text = self.driver.find_element(By.TAG_NAME, 'body').text

        try:
            # work around MS Edge JSON viewer garbage
            if text.startswith('1\n'):
                text = '{' + text.partition('{')[2]
            headers = json.loads(text)['headers']
        except ValueError:
            print(f"\nFailed to parse JSON from {repr(text)}")
            return None

        return headers

    def set_dnt_hashes(self):
        # MEGAHACK: make sha1 of "cookies=0" a valid DNT hash
        # so that the DNT policy checks to the domain that replies with cookies=X
        # will succeed when we don't send cookies along with the request
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'setDntHashes',"
            "  value: { 'cookies=0 test policy': 'f63ee614ebd77f8634b92633c6bb809a64b9a3d7' }"
            "}, done);")

    def assert_navigator_gpc_unset(self, msg=""):
        # GPC on Navigator should be unset (Chrome) or False (Firefox)
        assert self.js("""
return (typeof navigator.globalPrivacyControl == 'undefined' ||
  navigator.globalPrivacyControl === false);"""), msg

    def test_dnt_policy_check_should_happen_for_blocked_domains(self):
        PAGE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "recording_nontracking_domains.html"
        )
        DNT_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"

        self.clear_tracker_data()

        self.set_dnt_hashes()

        # mark the "DNT-compliant" domain for blocking
        self.block_domain(DNT_DOMAIN)

        # visit a page that loads a resource from that domain
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

        # perform a DNT policy check
        self.check_dnt(TEST_DOMAIN)

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
        self.set_dnt_hashes()

        # perform a DNT policy check
        result = self.check_dnt(TEST_DOMAIN)
        assert result, "One or more cookies were sent (cookies=0 policy hash did not match)"

    @pytest.mark.flaky(reruns=3, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_should_not_record_nontracking_domains(self):
        NONTRACKING_FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "recording_nontracking_domains.html"
        )
        TRACKING_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        NON_TRACKING_DOMAIN = "www.eff.org"

        # clear pre-trained/seed tracker data
        self.clear_tracker_data()

        # enable local learning
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-general-settings"]').click()
        self.find_el_by_css('#local-learning-checkbox').click()

        # visit a page containing two third-party resources,
        # one from a cookie-tracking domain
        # and one from a non-tracking domain
        self.load_url(NONTRACKING_FIXTURE_URL)

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
        TEST_URL = "https://httpbingo.org/get"
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        assert headers is not None, "It seems we failed to get headers"
        assert 'Dnt' in headers, "DNT header should have been present"
        assert 'Sec-Gpc' in headers, "GPC header should have been present"
        assert headers['Dnt'] == ["1"], 'DNT header should have been set to "1"'
        assert headers['Sec-Gpc'] == ["1"], 'Sec-Gpc header should have been set to "1"'

    def test_no_dnt_header_when_disabled_on_site(self):
        TEST_URL = "https://httpbingo.org/get"
        self.disable_badger_on_site(TEST_URL)
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        assert headers is not None, "It seems we failed to get headers"
        assert 'Dnt' not in headers, "DNT header should have been missing"
        assert 'Sec-Gpc' not in headers, "GPC header should have been missing"

    def test_no_dnt_header_when_dnt_disabled(self):
        TEST_URL = "https://httpbingo.org/get"

        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-general-settings"]').click()
        self.find_el_by_css('#enable_dnt_checkbox').click()

        headers = retry_until(partial(self.get_first_party_headers, TEST_URL),
                              times=8)
        assert headers is not None, "It seems we failed to get headers"
        assert 'Dnt' not in headers, "DNT header should have been missing"
        assert 'Sec-Gpc' not in headers, "GPC header should have been missing"

    def test_navigator_object(self):
        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)
        body_text = self.driver.find_element(By.TAG_NAME, 'body').text
        assert body_text == 'no tracking (navigator.doNotTrack="1")', (
            'navigator.doNotTrack should have been set to "1"')
        assert self.js("return navigator.globalPrivacyControl === true"), (
            "navigator.globalPrivacyControl should have been set to true")
        assert self.js("""
return Object.getOwnPropertyDescriptor(
  Navigator.prototype, 'globalPrivacyControl')?.get?.call(navigator);
"""), "GPC should be set on Navigator.prototype"

    def test_navigator_unmodified_when_disabled_on_site(self):
        self.disable_badger_on_site(self.FIXTURE_URL)

        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)

        # navigator.doNotTrack defaults to null in Chrome, "unspecified" in Firefox
        body_text = self.driver.find_element(By.TAG_NAME, 'body').text
        assert body_text[0:5] == 'unset', (
            "navigator.doNotTrack should be unset or \"unspecified\"")

        self.assert_navigator_gpc_unset("navigator.globalPrivacyControl should be unset or False")

    def test_navigator_disabling_on_site_parent_domain(self):
        """Needs to be consistent with test_disabling_on_site_parent_domain()"""
        self.disable_badger_on_site(self.FIXTURE_PARENT_DOMAIN)
        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)
        self.assert_navigator_gpc_unset("navigator.globalPrivacyControl should be unset or False")

    def test_navigator_disabling_on_site_wildcard(self):
        """Needs to be consistent with test_disabling_on_site_wildcard()"""
        self.disable_badger_on_site("*." + self.FIXTURE_PARENT_DOMAIN)
        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)
        self.assert_navigator_gpc_unset("navigator.globalPrivacyControl should be unset or False")

    def test_navigator_unmodified_when_dnt_disabled(self):
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-general-settings"]').click()
        self.find_el_by_css('#enable_dnt_checkbox').click()

        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)

        # navigator.doNotTrack defaults to null in Chrome, "unspecified" in Firefox
        body_text = self.driver.find_element(By.TAG_NAME, 'body').text
        assert body_text[0:5] == 'unset', (
            "navigator.doNotTrack should be unset or \"unspecified\"")

        self.assert_navigator_gpc_unset("navigator.globalPrivacyControl should be unset or False")

    def test_navigator_toggling_dnt_and_disabled_sites(self):
        # disable on site
        self.disable_badger_on_site(self.FIXTURE_URL)

        # disable sending DNT signals
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-general-settings"]').click()
        self.find_el_by_css('#enable_dnt_checkbox').click()

        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)
        assert self.js("return navigator.doNotTrack") != "1", (
            "navigator.doNotTrack should not be set")
        self.assert_navigator_gpc_unset("navigator.globalPrivacyControl should be unset or False")

        # re-enable sending DNT signals
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-general-settings"]').click()
        self.find_el_by_css('#enable_dnt_checkbox').click()

        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)
        assert self.js("return navigator.doNotTrack") != "1", (
            "navigator.doNotTrack should still not be set")
        self.assert_navigator_gpc_unset("navigator.globalPrivacyControl should still be unset or False")

        # re-enable on site
        self.reenable_badger_on_site("efforg.github.io")

        self.load_url(self.FIXTURE_URL, wait_for_body_text=True)
        assert self.js("return navigator.doNotTrack") == "1", (
            "navigator.doNotTrack should now be set")
        assert self.js("return navigator.globalPrivacyControl"), (
            "navigator.globalPrivacyControl should also be set")


if __name__ == "__main__":
    unittest.main()
