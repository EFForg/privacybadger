#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import pytest
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

    @pytest.mark.flaky(reruns=3, condition=pbtest.shim.browser_type == "firefox")
    def test_ga_js_surrogate(self):
        SURROGATE_HOST = "www.google-analytics.com"

        # clear pre-trained/seed tracker data
        self.clear_tracker_data()

        # verify the surrogate is present
        assert self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            f"return sdb.hostnames.hasOwnProperty('{SURROGATE_HOST}');"
        ), "surrogate is missing but should be present"

        # verify site loads
        assert self.load_ga_js_fixture(), (
            "page failed to load even before we did anything")

        # block ga.js (known to break the site)
        self.block_domain(SURROGATE_HOST)
        # back up the surrogate definition before removing it
        ga_backup = self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            f"return JSON.stringify(sdb.hostnames['{SURROGATE_HOST}']);"
        )
        # now remove the surrogate
        self.js(
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            f"delete sdb.hostnames['{SURROGATE_HOST}'];"
        )

        # verify site breaks
        assert not self.load_ga_js_fixture(), (
            "page loaded successfully when it should have failed")

        # re-enable surrogate
        self.open_window()
        self.load_url(self.options_url)
        self.js("(function () {"
            "let bg = chrome.extension.getBackgroundPage();"
            "const sdb = bg.require('surrogatedb');"
            f"let gaSurrogate = JSON.parse('{ga_backup}');"
            f"sdb.hostnames['{SURROGATE_HOST}'] = gaSurrogate;"
            "}());")

        # verify site loads again
        assert retry_until(self.load_ga_js_fixture), (
            "page failed to load after surrogation")


if __name__ == "__main__":
    unittest.main()
