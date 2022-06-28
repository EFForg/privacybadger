#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from selenium.common.exceptions import TimeoutException

from pbtest import retry_until


class SurrogatesTest(pbtest.PBSeleniumTest):
    """Integration tests to verify surrogate script functionality."""

    FIXTURE_URL = (
        "https://efforg.github.io/privacybadger-test-fixtures/html/"
        "ga_surrogate.html"
    )

    def load_ga_js_fixture(self, timeout=12):
        self.load_url(SurrogatesTest.FIXTURE_URL)
        try:
            self.wait_for_and_switch_to_frame('iframe', timeout=timeout)
            self.wait_for_text('h1', "It worked!", timeout=timeout)
            return True
        except TimeoutException:
            return False

    def test_ga_js_surrogate(self):
        SURROGATE_HOST = "www.google-analytics.com"

        # clear pre-trained/seed tracker data
        self.clear_tracker_data()

        # verify site loads
        assert self.load_ga_js_fixture(), (
            "page failed to load even before we did anything")

        # block ga.js (should break the site)
        self.block_domain(SURROGATE_HOST)
        # disable surrogates
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'disableSurrogates'"
            "}, done);")

        # verify site breaks
        assert not self.load_ga_js_fixture(), (
            "page loaded successfully when it should have failed")

        # re-enable surrogates
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'restoreSurrogates'"
            "}, done);")

        # verify site loads again
        assert retry_until(self.load_ga_js_fixture), (
            "page failed to load after surrogation")


if __name__ == "__main__":
    unittest.main()
