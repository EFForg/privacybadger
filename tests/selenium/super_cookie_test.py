#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest

import pbtest

from functools import partial


class SuperCookieTest(pbtest.PBSeleniumTest):
    """Make sure we detect potential supercookies. """

    def detected_tracking_by(self, origin):
        self.load_url(self.bg_url)

        CHECK_SNITCH_MAP_JS = """return (
  badger.storage.getBadgerStorageObject('snitch_map')
    .getItemClones().hasOwnProperty('{}')
);""".format(origin)

        return self.js(CHECK_SNITCH_MAP_JS)

    # test for https://github.com/EFForg/privacybadger/pull/1403
    # TODO remove retrying entire test after we revert 879a74f807999a2135e4d48bb5efbd8a1beff4f8
    @pbtest.repeat_if_failed(5)
    def test_async_tracking_misattribution_bug(self):
        self.load_url(
            "https://cdn.rawgit.com/ghostwords"
            "/d3685dc39f7e67dddf1edf2614beb6fc/raw/a78cfd6c86d51a8d8ab1e214e4e49e2c025d4715"
            "/privacy_badger_async_bug_test_fixture.html"
        )

        # the above HTML page reloads itself furiously to trigger our bug
        # we need to wait for it to finish reloading
        self.wait_for_script("return window.DONE_RELOADING === true")

        tracking_detected = pbtest.retry_until(
            partial(self.detected_tracking_by, "githack.com"))

        # the HTML page contains:

        # an iframe from gistcdn.githack.com that writes to localStorage
        self.assertTrue(tracking_detected,
            msg="IFrame sets localStorage but was not flagged as a tracker.")

        # and an image from raw.githubusercontent.com that doesn't do any tracking
        self.assertFalse(self.detected_tracking_by("raw.githubusercontent.com"),
            msg="Image is not a tracker but was flagged as one.")

    def test_should_detect_ls_of_third_party_frame(self):
        # TODO We get some intermittent failures for this test.

        # It seems we sometimes miss the setting of localStorage items,
        # perhaps because the script runs before we start intercepting the calls.

        # Perhaps related to: https://github.com/ghostwords/chameleon/issues/5
        self.load_url("https://rawgit.com/gunesacar/24d81a5c964cb563614162c264be32f0/raw/8fa10f97b87343dfb62ae9b98b753c73a995157e/frame_ls.html")
        # TODO might also be related to https://github.com/EFForg/privacybadger/pull/1522
        time.sleep(1)
        self.assertTrue(pbtest.retry_until(
            partial(self.detected_tracking_by, "githack.com"), times=2))

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        self.load_url(
            "https://gistcdn.githack.com/gunesacar"
            "/6f0c39fb728a218ccd91215bfefbd4e0/raw/f438eb4e5ce10dc8623a8834b1298fd4a846c6fa"
            "/low_entropy_localstorage_from_third_party_script.html"
        )
        time.sleep(4)
        self.assertFalse(self.detected_tracking_by("githack.com"))

    def test_should_not_detect_first_party_ls(self):
        self.load_url("https://gistcdn.githack.com/gunesacar/43e2ad2b76fa5a7f7c57/raw/44e7303338386514f1f5bb4166c8fd24a92e97fe/set_ls.html")
        time.sleep(4)
        self.assertFalse(self.detected_tracking_by("githack.com"))

    def test_should_not_detect_ls_of_third_party_script(self):
        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url(
            "https://rawgit.com/gunesacar"
            "/b366e3b03231dbee9709fe0a614faf10/raw/48e02456aa257e272092b398772a712391cf8b11"
            "/localstorage_from_third_party_script.html"
        )
        time.sleep(4)
        self.assertFalse(self.detected_tracking_by("githack.com"))


if __name__ == "__main__":
    unittest.main()
