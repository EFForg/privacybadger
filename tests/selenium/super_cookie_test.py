#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from functools import partial


class SupercookieTest(pbtest.PBSeleniumTest):
    """Make sure we detect potential supercookies. """

    def get_snitch_map_for(self, origin):
        self.open_window() # don't replace the test page to allow for retrying
        self.load_url(self.options_url)

        CHECK_SNITCH_MAP_JS = (
            "return chrome.extension.getBackgroundPage()"
            ".badger.storage.getStore('snitch_map')"
            ".getItemClones()[arguments[0]];"
        )

        return self.js(CHECK_SNITCH_MAP_JS, origin)

    def setUp(self):
        # enable local learning
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

    # test for https://github.com/EFForg/privacybadger/pull/1403
    # TODO remove retrying entire test after we revert 879a74f807999a2135e4d48bb5efbd8a1beff4f8
    @pbtest.repeat_if_failed(5)
    def test_async_tracking_attribution_bug(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        self.load_url((
            "https://privacybadger-tests.{}/html/"
            "async_localstorage_attribution_bug.html"
        ).format(FIRST_PARTY_BASE))

        # the above HTML page reloads itself furiously to trigger our bug
        # we need to wait for it to finish reloading
        self.wait_for_script("return window.DONE_RELOADING === true")

        # the HTML page contains:

        # an iframe from THIRD_PARTY_BASE that writes to localStorage
        self.assertEqual(
            pbtest.retry_until(partial(self.get_snitch_map_for, THIRD_PARTY_BASE)),
            [FIRST_PARTY_BASE],
            msg="Frame sets localStorage but was not flagged as a tracker.")

        # and an image from raw.githubusercontent.com that doesn't do any tracking
        self.assertFalse(self.get_snitch_map_for("raw.githubusercontent.com"),
            msg="Image is not a tracker but was flagged as one.")


    def test_should_detect_ls_of_third_party_frame(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        self.assertFalse(self.get_snitch_map_for(THIRD_PARTY_BASE))

        self.load_url((
            "https://privacybadger-tests.{}/html/"
            "localstorage.html"
        ).format(FIRST_PARTY_BASE))

        # TODO We get some intermittent failures for this test.
        # It seems we sometimes miss the setting of localStorage items
        # because the script runs after we already checked what's in localStorage.
        # We can work around this race condition by reloading the page.
        self.driver.refresh()

        self.assertEqual(
            pbtest.retry_until(partial(self.get_snitch_map_for, THIRD_PARTY_BASE), times=3),
            [FIRST_PARTY_BASE]
        )

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"
        self.assertFalse(self.get_snitch_map_for(THIRD_PARTY_BASE))
        self.load_url((
            "https://privacybadger-tests.{}/html/"
            "localstorage_low_entropy.html"
        ).format(FIRST_PARTY_BASE))
        self.driver.refresh()
        self.assertFalse(self.get_snitch_map_for(THIRD_PARTY_BASE))

    def test_should_not_detect_first_party_ls(self):
        BASE_DOMAIN = "efforg.github.io"
        self.load_url((
            "https://{}/privacybadger-test-fixtures/html/"
            "localstorage/set_ls.html"
        ).format(BASE_DOMAIN))
        self.driver.refresh()
        self.assertFalse(self.get_snitch_map_for(BASE_DOMAIN))

    def test_should_not_detect_ls_of_third_party_script(self):
        FIRST_PARTY_BASE = "eff.org"
        THIRD_PARTY_BASE = "efforg.github.io"

        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url((
            "https://privacybadger-tests.{}/html/"
            "localstorage_from_third_party_script.html"
        ).format(FIRST_PARTY_BASE))

        self.driver.refresh()

        self.assertFalse(self.get_snitch_map_for(FIRST_PARTY_BASE))
        self.assertFalse(self.get_snitch_map_for(THIRD_PARTY_BASE))


if __name__ == "__main__":
    unittest.main()
