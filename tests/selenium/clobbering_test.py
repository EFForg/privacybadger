#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

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
        # TODO remove delays from fixture once race condition (https://crbug.com/478183) is fixed
        FIXTURE_URL = (
            "https://gitcdn.link/cdn/ghostwords/"
            "95d3795b3e2d59b0a729825050c252d2/raw/a1017b1b0e991dc4a2f2903afb221b1f76da2300/"
            "privacy-badger-clobbering-fixture.html"
        )
        FRAME_DOMAIN = "githack.com"
        COOKIEBLOCK_JS = (
            "(function () {"
            "let bg = chrome.extension.getBackgroundPage();"
            "bg.badger.storage.setupHeuristicAction('%s', bg.constants.COOKIEBLOCK);"
            "}());"
        ) % FRAME_DOMAIN

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
                self.txt_by_css("#" + selector), expected,
                "localStorage (%s) was not read successfully"
                "for some reason" % selector
            )

        # mark the frame domain for cookieblocking
        self.load_url(self.options_url)
        self.js(COOKIEBLOCK_JS)

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
                self.txt_by_css("#" + selector), expected,
                "localStorage (%s) was read despite cookieblocking" % selector
            )

if __name__ == "__main__":
    unittest.main()
