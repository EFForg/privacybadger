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
            ".badger.storage.getBadgerStorageObject('snitch_map')"
            ".getItemClones()[arguments[0]];"
        )

        return self.js(CHECK_SNITCH_MAP_JS, origin)

    # test for https://github.com/EFForg/privacybadger/pull/1403
    # TODO remove retrying entire test after we revert 879a74f807999a2135e4d48bb5efbd8a1beff4f8
    @pbtest.repeat_if_failed(5)
    def test_async_tracking_misattribution_bug(self):
        self.load_url(
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "async_localstorage_attribution_bug.html"
        )

        # the above HTML page reloads itself furiously to trigger our bug
        # we need to wait for it to finish reloading
        self.wait_for_script("return window.DONE_RELOADING === true")

        # the HTML page contains:

        # an iframe from gistcdn.githack.com that writes to localStorage
        self.assertEqual(
            pbtest.retry_until(partial(self.get_snitch_map_for, "githack.com")),
            ["efforg.github.io"],
            msg="IFrame sets localStorage but was not flagged as a tracker.")

        # and an image from raw.githubusercontent.com that doesn't do any tracking
        self.assertFalse(self.get_snitch_map_for("raw.githubusercontent.com"),
            msg="Image is not a tracker but was flagged as one.")


    def test_should_detect_ls_of_third_party_frame(self):
        self.load_url(
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "localstorage.html"
        )

        # TODO We get some intermittent failures for this test.
        # It seems we sometimes miss the setting of localStorage items
        # because the script runs after we already checked what's in localStorage.
        # We can work around this race condition by reloading the page.
        self.driver.refresh()

        self.assertEqual(
            pbtest.retry_until(partial(self.get_snitch_map_for, "githack.com"), times=3),
            ["efforg.github.io"]
        )

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        self.load_url(
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "localstorage_low_entropy.html"
        )
        self.driver.refresh()
        self.assertFalse(self.get_snitch_map_for("githack.com"))

    def test_should_not_detect_first_party_ls(self):
        self.load_url(
            "https://gistcdn.githack.com/gunesacar/"
            "43e2ad2b76fa5a7f7c57/raw/44e7303338386514f1f5bb4166c8fd24a92e97fe/"
            "set_ls.html"
        )
        self.driver.refresh()
        self.assertFalse(self.get_snitch_map_for("githack.com"))

    def test_should_not_detect_ls_of_third_party_script(self):
        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url(
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "localstorage_from_third_party_script.html"
        )
        self.driver.refresh()
        self.assertFalse(self.get_snitch_map_for("efforg.github.io")) # page URL
        self.assertFalse(self.get_snitch_map_for("githack.com")) # script URL


if __name__ == "__main__":
    unittest.main()
