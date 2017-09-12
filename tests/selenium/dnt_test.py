#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from time import sleep

from window_utils import switch_to_window_with_url


CHECK_FOR_DNT_POLICY_JS = """badger.checkForDNTPolicy(
'{}', 0, r => window.DNT_CHECK_RESULT = r
);"""


class DNTTest(pbtest.PBSeleniumTest):
    """Tests to make sure DNT policy checking works as expected."""

    def domain_was_detected(self, domain):
        return self.js("""return (
  Object.keys(badger.tabData).some(tab_id => {{
    let origins = badger.tabData[tab_id].origins;
    return origins.hasOwnProperty('{}');
  }})
);""".format(domain))

    def domain_was_blocked(self, domain):
        self.assertTrue(self.domain_was_detected(domain),
            msg="Domain should have been detected.")

        return self.js("""return (
  Object.keys(badger.tabData).some(tab_id => {{
    let origins = badger.tabData[tab_id].origins;
    return origins.hasOwnProperty('{}') && !!origins['{}'];
  }})
);""".format(domain, domain))

    def test_dnt_check_should_happen_for_blocked_domains(self):
        PAGE_URL = (
"""https://cdn.rawgit.com/ghostwords/74585c942a918509b20bf2db5659646e/raw/f42d25717e5b4f735c7affa527a2e0b62286c005/privacy_badger_dnt_test_fixture.html"""
        )
        DNT_DOMAIN = "www.eff.org"
        BLOCK_DOMAIN_JS = """(function () {{
  badger.storage.setupHeuristicAction('{}', constants.BLOCK);
}}());""".format(DNT_DOMAIN)

        # mark a DNT-compliant domain for blocking
        self.load_url(self.bg_url, wait_on_site=1)
        self.js(BLOCK_DOMAIN_JS)

        # need to keep Badger's background page open for our changes to persist
        # so, open and switch to a new window
        self.open_window()

        # visit a page that loads a resource from that DNT-compliant domain
        self.load_url(PAGE_URL)

        # switch back to Badger's background page
        switch_to_window_with_url(self.driver, self.bg_url)

        # verify that the domain is blocked
        self.assertTrue(self.domain_was_blocked(DNT_DOMAIN),
            msg="DNT-compliant resource should have been blocked at first.")

        # switch back to the page with the DNT-compliant resource
        switch_to_window_with_url(self.driver, PAGE_URL)

        # reload it
        self.load_url(PAGE_URL)

        # wait a second for the DNT check to complete
        sleep(1)

        # switch back to Badger's background page
        switch_to_window_with_url(self.driver, self.bg_url)

        # verify that the domain is allowed
        self.assertFalse(self.domain_was_blocked(DNT_DOMAIN),
            msg="DNT-compliant resource should have gotten unblocked.")

    # TODO reenable when the oldest Firefox tests run on is 55 or later
    # (ESR is on 52 until June 2018 or so)
    # alternatively, figure out how to disable more conditionally
    @pbtest.if_firefox(unittest.skip("Disabled until Firefox fixes bug: https://github.com/EFForg/privacybadger/pull/1347#issuecomment-297573773"))
    def test_dnt_check_should_not_set_cookies(self):
        TEST_DOMAIN = "dnt-test.trackersimulator.org"
        TEST_URL = "https://{}/".format(TEST_DOMAIN)

        # verify that the domain itself doesn't set cookies
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "No cookies initially")

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "DNT policy URL set a cookie")

        # verify we got a cookie
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "We still have just one cookie")

        # clear cookies and verify
        self.driver.delete_all_cookies()
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "No cookies again")

        # perform a DNT policy check
        self.load_url(self.bg_url, wait_on_site=1)
        self.js(CHECK_FOR_DNT_POLICY_JS.format(TEST_DOMAIN))
        # wait until checkForDNTPolicy completed
        self.wait_for_script("return window.DNT_CHECK_RESULT === false")

        # check that we didn't get cookied by the DNT URL
        self.load_url(TEST_URL)
        self.assertEqual(len(self.driver.get_cookies()), 0,
            "Shouldn't have any cookies after the DNT check")

    def test_dnt_check_should_not_send_cookies(self):
        TEST_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        TEST_URL = "https://{}/".format(TEST_DOMAIN)

        # directly visit a DNT policy URL known to set cookies
        self.load_url(TEST_URL + ".well-known/dnt-policy.txt")
        self.assertEqual(len(self.driver.get_cookies()), 1,
            "DNT policy URL set a cookie")

        # how to check we didn't send a cookie along with request?
        # the DNT policy URL used by this test returns "cookies=X"
        # where X is the number of cookies it got
        # MEGAHACK: make sha1 of "cookies=0" a valid DNT hash
        self.load_url(self.bg_url, wait_on_site=1)
        self.js("""badger.storage.updateDNTHashes(
{ "cookies=0 test policy": "f63ee614ebd77f8634b92633c6bb809a64b9a3d7" });""")

        # perform a DNT policy check
        self.js(CHECK_FOR_DNT_POLICY_JS.format(TEST_DOMAIN))
        # wait until checkForDNTPolicy completed
        self.wait_for_script("return typeof window.DNT_CHECK_RESULT != 'undefined';")
        # get the result
        result = self.js("return window.DNT_CHECK_RESULT;")
        self.assertTrue(result, "No cookies were sent")


if __name__ == "__main__":
    unittest.main()
