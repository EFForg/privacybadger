#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
import json


class SuperCookieTest(pbtest.PBSeleniumTest):
    """Make sure we detect potential supercookies. """

    def has_supercookies(self, origin):
        """Check if the given origin has supercookies in PB's localStorage."""
        self.load_url(pbtest.PB_CHROME_BG_URL)
        get_sc_domains_js = "return JSON.stringify(pb.storage.getBadgerStorageObject('supercookie_domains').getItemClones())"
        supercookieDomains = json.loads(self.js(get_sc_domains_js))
        return origin in supercookieDomains

    # localStorage (ls) tests
    def test_should_detect_ls_of_third_party_frame(self):
        self.load_url("https://jsfiddle.net/uon507ut/embedded/result/",
                      wait_on_site=10)
        self.assertTrue(self.has_supercookies("rawgit.com"))

    def test_should_not_detect_low_entropy_ls_of_third_party_frame(self):
        self.load_url("https://jsfiddle.net/21za32ve/1/embedded/result/",
                      wait_on_site=10)
        self.assertFalse(self.has_supercookies("rawgit.com"))

    def test_should_not_detect_first_party_ls(self):
        self.load_url("https://rawgit.com/gunesacar/43e2ad2b76fa5a7f7c57/raw/44e7303338386514f1f5bb4166c8fd24a92e97fe/set_ls.html",  # noqa
                        wait_on_site=10)
        self.assertFalse(self.has_supercookies("rawgit.com"))

    def test_should_not_detect_ls_of_third_party_script(self):
        # a third-party script included by the top page (not a 3rd party frame)
        self.load_url("https://jsfiddle.net/gzehyh92/embedded/result/",
                      wait_on_site=10)
        self.assertFalse(self.has_supercookies("rawgit.com"))

if __name__ == "__main__":
    unittest.main()
