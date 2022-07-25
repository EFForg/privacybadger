#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

class ContentFilteringTest(pbtest.PBSeleniumTest):
    """Content filtering tests."""

    # for blocking tests
    FIXTURE_DOMAIN = "efforg.github.io"
    FIXTURE_URL = (
        f"https://{FIXTURE_DOMAIN}/privacybadger-test-fixtures/html/"
        "3p_script_with_load_status.html"
    )
    THIRD_PARTY_DOMAIN = "privacybadger-tests.eff.org"
    SELECTOR = "#third-party-load-result"

    # for cookie tests
    COOKIE_FIXTURE_URL = (
        "https://efforg.github.io/privacybadger-test-fixtures/html/"
        "recording_nontracking_domains.html"
    )
    COOKIE_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"

    def setUp(self):
        self.clear_tracker_data()

    def wait_for_status_output(self, selector=SELECTOR):
        self.wait_for_script(
            "return document.querySelector(arguments[0]).textContent",
            selector)

    def assert_block(self):
        self.wait_for_status_output()
        assert self.find_el_by_css(self.SELECTOR).text == "error", (
            "3rd-party should've gotten blocked")

    def assert_load(self):
        self.wait_for_status_output()
        assert self.find_el_by_css(self.SELECTOR).text == "success", (
            "3rd-party should've loaded successfully")

    def test_blocking_fixture_loads_when_unblocked(self):
        self.load_url(self.FIXTURE_URL)
        self.assert_load()

    def test_blocking(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        self.load_url(self.FIXTURE_URL)
        self.assert_block()

    def test_cookieblocking_stops_saving(self):
        self.load_url(f"https://{self.COOKIE_DOMAIN}/")
        assert not self.driver.get_cookies(), (
            "Visiting the domain directly does not set a cookie")

        self.load_url(self.COOKIE_FIXTURE_URL)
        self.load_url(f"https://{self.COOKIE_DOMAIN}/")
        assert len(self.driver.get_cookies()) == 1, (
            "Cookie fixture should have set a cookie")

        self.driver.delete_all_cookies()
        self.cookieblock_domain(self.COOKIE_DOMAIN)

        self.load_url(self.COOKIE_FIXTURE_URL)
        self.load_url(f"https://{self.COOKIE_DOMAIN}/")
        assert not self.driver.get_cookies(), (
            "Cookie fixture should have been blocked from setting a cookie")

    def test_cookieblocking_stops_sending(self):
        self.load_url(self.COOKIE_FIXTURE_URL)
        self.wait_for_and_switch_to_frame("iframe[src]", timeout=1)
        self.wait_for_status_output('body')
        assert self.find_el_by_css('body').text == "cookies=0", (
            "No cookies should've been sent to start with")

        self.load_url(self.COOKIE_FIXTURE_URL)
        self.wait_for_and_switch_to_frame("iframe[src]", timeout=1)
        self.wait_for_status_output('body')
        assert self.find_el_by_css('body').text == "cookies=1", (
            "We should have sent a cookie at this point")

        self.cookieblock_domain(self.COOKIE_DOMAIN)

        self.load_url(self.COOKIE_FIXTURE_URL)
        self.wait_for_and_switch_to_frame("iframe[src]", timeout=1)
        self.wait_for_status_output('body')
        assert self.find_el_by_css('body').text == "cookies=0", (
            "No cookies should have been sent by the cookieblocked domain")

    def test_userblock(self):
        self.set_user_action(self.THIRD_PARTY_DOMAIN, "block")

        self.load_url(self.FIXTURE_URL)
        self.assert_block()

    def test_usercookieblock(self):
        self.set_user_action(self.COOKIE_DOMAIN, "cookieblock")

        self.load_url(self.COOKIE_FIXTURE_URL)
        self.load_url(f"https://{self.COOKIE_DOMAIN}/")
        assert not self.driver.get_cookies(), (
            "Cookie fixture should have been blocked from setting a cookie")

    def test_userallow(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.set_user_action(self.THIRD_PARTY_DOMAIN, "allow")

        self.load_url(self.FIXTURE_URL)
        self.assert_load()

    def test_disabling_on_site(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.disable_badger_on_site(self.FIXTURE_URL)

        self.load_url(self.FIXTURE_URL)
        self.assert_load()

    def test_reenabling_on_site(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.disable_badger_on_site(self.FIXTURE_URL)
        self.reenable_badger_on_site(self.FIXTURE_DOMAIN)

        self.load_url(self.FIXTURE_URL)
        self.assert_block()

    def test_ignoring_dnt_compliance(self):
        """We should ignore DNT compliance when DNT policy checking is off."""

        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.set_dnt(self.THIRD_PARTY_DOMAIN)

        self.load_url(self.FIXTURE_URL)
        self.assert_load()
        self.open_popup(self.FIXTURE_URL)
        assert self.get_domain_slider_state(self.THIRD_PARTY_DOMAIN) == "allow", (
            "DNT-compliant resource should be allowed")
        self.close_window_with_url(self.FIXTURE_URL)

        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#check_dnt_policy_checkbox').click()

        self.load_url(self.FIXTURE_URL)
        self.assert_block()
        self.open_popup(self.FIXTURE_URL)
        assert self.get_domain_slider_state(self.THIRD_PARTY_DOMAIN) == "block", (
            "DNT-compliant resource should now be blocked")


if __name__ == "__main__":
    unittest.main()
