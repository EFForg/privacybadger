#!/usr/bin/env python

import unittest

import pytest

import pbtest


class ClobberingTest(pbtest.PBSeleniumTest):
    def test_localstorage_clobbering(self):
        LOCALSTORAGE_TESTS = [
            # (test result element ID, expected stored, expected empty)
            ('get-item', "qwerty", "null"),
            ('get-property', "asdf", "undefined"),
            ('get-item-proto', "qwerty", "null"),
            ('get-item-srcdoc', "qwerty", "null"),
            ('get-property-srcdoc', "asdf", "undefined"),
            ('get-item-frames', "qwerty", "null"),
            ('get-property-frames', "asdf", "undefined"),
        ]
        # page loads a frame that writes to and reads from localStorage
        # TODO remove delays from fixture once configurable main world
        # TODO injection race conditions are fixed
        FIXTURE_URL = "https://privacybadger-tests.eff.org/html/clobbering.html"
        FRAME_DOMAIN = "efforg.github.io"

        # first allow localStorage to be set
        self.load_url(FIXTURE_URL)
        self.wait_for_and_switch_to_frame('iframe')
        for selector, expected, _ in LOCALSTORAGE_TESTS:
            # wait for each test to run
            self.wait_for_script(
                "return document.getElementById('%s')"
                ".textContent != '...';" % selector,
                timeout=2,
                message=(
                    "Timed out waiting for localStorage (%s) to finish ... "
                    "This probably means the fixture "
                    "errored out somewhere." % selector
                )
            )
            self.assertEqual(
                expected, self.txt_by_css("#" + selector),
                "localStorage (%s) was not read successfully"
                "for some reason" % selector
            )

        # mark the frame domain for cookieblocking
        self.cookieblock_domain(FRAME_DOMAIN)

        # now rerun and check results for various localStorage access tests
        self.load_url(FIXTURE_URL)
        self.wait_for_and_switch_to_frame('iframe')
        for selector, _, expected in LOCALSTORAGE_TESTS:
            # wait for each test to run
            self.wait_for_script(
                "return document.getElementById('%s')"
                ".textContent != '...';" % selector,
                timeout=2,
                message=(
                    "Timed out waiting for localStorage (%s) to finish ... "
                    "This probably means the fixture "
                    "errored out somewhere." % selector
                )
            )
            self.assertEqual(
                expected, self.txt_by_css("#" + selector),
                "localStorage (%s) was read despite cookieblocking" % selector
            )

    @pytest.mark.flaky(reruns=9)
    @pytest.mark.xfail(pbtest.shim.browser_type == "chrome", reason="https://crbug.com/1149619")
    def test_referrer_header(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "referrer.html"
        )
        THIRD_PARTY_DOMAIN = "httpbin.org"

        def verify_referrer_header(expected, failure_message):
            self.load_url(FIXTURE_URL)
            self.wait_for_script(
                "return document.getElementById('referrer').textContent != '';",
                timeout=10)
            referrer = self.txt_by_css("#referrer")
            self.assertEqual("Referer=", referrer[0:8], "Unexpected page output")
            self.assertEqual(expected, referrer[8:], failure_message)

        # verify base case
        verify_referrer_header(
            FIXTURE_URL,
            "Unexpected default referrer header")

        # cookieblock the domain fetched by the fixture
        self.cookieblock_domain(THIRD_PARTY_DOMAIN)

        # recheck what the referrer header looks like now after cookieblocking
        verify_referrer_header(
            "https://efforg.github.io/",
            "Referrer header does not appear to be origin-only")


if __name__ == "__main__":
    unittest.main()
