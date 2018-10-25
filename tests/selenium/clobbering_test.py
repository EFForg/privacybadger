#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest


class ClobberingTest(pbtest.PBSeleniumTest):
    def test_localstorage_clobbering(self):
        FIXTURE_TEST_RESULT_IDS = [
            'get-item',
        ]
        # page loads a frame that writes to and reads from localStorage
        # TODO remove delays from fixture once race condition (https://crbug.com/478183) is fixed
        FIXTURE_URL = (
            "https://gitcdn.link/cdn/ghostwords/"
            "95d3795b3e2d59b0a729825050c252d2/raw/df849c9ec692fb047f4a3b2c7218f8354fe2ce60/"
            "privacy-badger-clobbering-fixture.html"
        )
        FRAME_DOMAIN = "githack.com"
        COOKIEBLOCK_JS = (
            "badger.storage.setupHeuristicAction('%s', constants.COOKIEBLOCK);"
        ) % FRAME_DOMAIN

        # first allow localStorage to be set
        self.load_url(FIXTURE_URL)
        self.wait_for_and_switch_to_frame('iframe')
        for selector in FIXTURE_TEST_RESULT_IDS:
            # wait for each test to run
            self.wait_for_script(
                "return document.getElementById('%s')"
                ".textContent != '...';" % selector
            )
            self.assertNotEqual(
                self.txt_by_css("#" + selector), "",
                "localStorage (%s) was not read successfully"
                "for some reason" % selector
            )

        # mark the frame domain for cookieblocking
        self.load_url(self.options_url)
        self.js(COOKIEBLOCK_JS)

        # now rerun and check results for various localStorage access tests
        self.load_url(FIXTURE_URL)
        self.wait_for_and_switch_to_frame('iframe')
        for selector in FIXTURE_TEST_RESULT_IDS:
            # wait for each test to run
            self.wait_for_script(
                "return document.getElementById('%s')"
                ".textContent != '...';" % selector
            )
            self.assertEqual(
                self.txt_by_css("#" + selector), "",
                "localStorage (%s) was read despite cookieblocking" % selector
            )

if __name__ == "__main__":
    unittest.main()
