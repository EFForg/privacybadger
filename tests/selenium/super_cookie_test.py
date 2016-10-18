#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
import json


class SuperCookieTest(pbtest.PBSeleniumTest):
    """Make sure we detect potential supercookies. """

    def has_supercookies(self, origin):
        """Check if the given origin has supercookies in PB's localStorage."""
        self.load_url(pbtest.PB_CHROME_BG_URL, wait_on_site=1)
        get_sc_domains_js = "return JSON.stringify(badger.storage."\
            "getBadgerStorageObject('supercookie_domains').getItemClones())"
        supercookieDomains = json.loads(self.js(get_sc_domains_js))
        return origin in supercookieDomains

    def test_should_detect_ls_of_third_party_frame(self):
        """We get some intermittent failures for this test.

        It seems we sometimes miss the setting of localStorage items,
        perhaps because the script runs before we start intercepting the calls.

        Perhaps related to: https://github.com/ghostwords/chameleon/issues/5
        """
        self.load_url("https://rawgit.com/gunesacar/24d81a5c964cb563614162c264be32f0/raw/8fa10f97b87343dfb62ae9b98b753c73a995157e/frame_ls.html",  # noqa
                      wait_on_site=5)
        self.driver.switch_to_frame(self.driver.
                                    find_element_by_tag_name("iframe"))
        print(self.js("return localStorage['frameId']"))
        self.assertTrue(self.has_supercookies("githack.com"))

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        self.load_url("https://rawgit.com/gunesacar/gunesacar/6f0c39fb728a218ccd91215bfefbd4e0/raw/f438eb4e5ce10dc8623a8834b1298fd4a846c6fa/low_entropy_localstorage_from_third_party_script.html",  # noqa
                      wait_on_site=5)
        self.assertFalse(self.has_supercookies("githack.com"))

    def test_should_not_detect_first_party_ls(self):
        self.load_url("https://gistcdn.githack.com/gunesacar/43e2ad2b76fa5a7f7c57/raw/44e7303338386514f1f5bb4166c8fd24a92e97fe/set_ls.html",  # noqa
                      wait_on_site=5)
        self.assertFalse(self.has_supercookies("githack.com"))

    def test_should_not_detect_ls_of_third_party_script(self):
        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url("https://rawgit.com/gunesacar/b366e3b03231dbee9709fe0a614faf10/raw/48e02456aa257e272092b398772a712391cf8b11/localstorage_from_third_party_script.html",  # noqa
                      wait_on_site=5)
        self.assertFalse(self.has_supercookies("githack.com"))

if __name__ == "__main__":
    unittest.main()
