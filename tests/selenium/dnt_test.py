#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import json
import unittest

import pbtest

from functools import partial

from pbtest import retry_until
from window_utils import switch_to_window_with_url


CHECK_FOR_DNT_POLICY_JS = """badger.checkForDNTPolicy(
'{}', r => window.DNT_CHECK_RESULT = r
);"""


class DNTTest(pbtest.PBSeleniumTest):
    """Tests to make sure DNT policy checking works as expected."""

    # TODO switch to non-delayed version (see below)
    # once race condition (https://crbug.com/478183) is fixed
    NAVIGATOR_DNT_TEST_URL = (
        "https://cdn.rawgit.com/ghostwords/"
        "1c50869a0469e38d5dabd53f1204d3de/raw/01e06af8d2b3e35228bf8f000bdc12d0b2871b64/"
        "privacy-badger-navigator-donottrack-delayed-fixture.html"
        # non-delayed version:
        #"9fc6900566a2f93edd8e4a1e48bbaa28/raw/741627c60ca53be69bc11bf21d6d1d0b42edb52a/"
        #"privacy-badger-navigator-donottrack-fixture.html"
    )

    def get_first_party_headers(self, url):
        self.load_url(url)

        text = self.driver.find_element_by_tag_name('body').text

        try:
            headers = json.loads(text)['headers']
        except ValueError:
            print("\nFailed to parse JSON from {}".format(repr(text)))
            return None

        return headers

    def disable_badger_on_site(self, url):
        self.load_url(self.options_url)
        self.driver.find_element_by_css_selector(
            'a[href="#tab-whitelisted-domains"]').click()
        self.driver.find_element_by_id('newWhitelistDomain').send_keys(url)
        self.driver.find_element_by_css_selector('button.addButton').click()

    def domain_was_recorded(self, domain):
        return self.js("""return (
  Object.keys(badger.storage.action_map.getItemClones()).indexOf('{}') != -1
);""".format(domain))

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
    return origins.hasOwnProperty('{}') && constants.BLOCKED_ACTIONS.has(origins['{}']);
  }})
);""".format(domain, domain))

    @pbtest.repeat_if_failed(3)
    def test_dnt_check_should_happen_for_blocked_domains(self):
        PAGE_URL = (
            "https://cdn.rawgit.com/ghostwords/"
            "74585c942a918509b20bf2db5659646e/raw/f42d25717e5b4f735c7affa527a2e0b62286c005/"
            "privacy_badger_dnt_test_fixture.html"
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

        # switch back to Badger's background page
        switch_to_window_with_url(self.driver, self.bg_url)

        # verify that the domain is allowed
        was_blocked = retry_until(
            partial(self.domain_was_blocked, DNT_DOMAIN),
            tester=lambda x: not x,
            msg="Waiting a bit for DNT check to complete and retrying ...")

        self.assertFalse(was_blocked, msg="DNT-compliant resource should have gotten unblocked.")

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

    def test_should_not_record_nontracking_domains(self):
        TEST_URL = (
            "https://cdn.rawgit.com/ghostwords/"
            "eef2c982fc3151e60a78136ca263294d/raw/13ed3d1e701994640b8d8065b835f8a9684ece92/"
            "privacy_badger_recording_nontracking_domains_fixture.html"
        )
        TRACKING_DOMAIN = "dnt-request-cookies-test.trackersimulator.org"
        NON_TRACKING_DOMAIN = "dnt-test.trackersimulator.org"

        # open Badger's background page
        self.load_url(self.bg_url, wait_on_site=1)

        # need to keep Badger's background page open to record what's happening
        # so, open and switch to a new window
        self.open_window()

        # visit a page containing two third-party resources,
        # one from a cookie-tracking domain
        # and one from a non-tracking domain
        self.load_url(TEST_URL)

        # switch back to Badger's background page
        switch_to_window_with_url(self.driver, self.bg_url)

        # verify that the cookie-tracking domain was recorded
        self.assertTrue(
            self.domain_was_recorded(TRACKING_DOMAIN),
            "Tracking domain should have gotten recorded"
        )

        # verify that the non-tracking domain was not recorded
        self.assertFalse(
            self.domain_was_recorded(NON_TRACKING_DOMAIN),
            "Non-tracking domain should not have gotten recorded"
        )

    def test_first_party_dnt_header(self):
        TEST_URL = "https://httpbin.org/get"
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL))
        self.assertTrue(headers is not None, "It seems we failed to get DNT headers")
        self.assertIn('Dnt', headers, "DNT header should have been present")
        self.assertEqual(headers['Dnt'], "1",
            'DNT header should have been set to "1"')

    def test_no_dnt_header_when_disabled(self):
        TEST_URL = "https://httpbin.org/get"
        self.disable_badger_on_site(TEST_URL)
        headers = retry_until(partial(self.get_first_party_headers, TEST_URL))
        self.assertTrue(headers is not None, "It seems we failed to get DNT headers")
        self.assertNotIn('Dnt', headers, "DNT header should have been missing")

    def test_navigator_object(self):
        self.load_url(DNTTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)

        self.assertEqual(
            self.driver.find_element_by_tag_name('body').text,
            'no tracking (navigator.doNotTrack="1")',
            "navigator.DoNotTrack should have been set to \"1\""
        )

    def test_navigator_left_alone_when_disabled(self):
        self.disable_badger_on_site(DNTTest.NAVIGATOR_DNT_TEST_URL)

        self.load_url(DNTTest.NAVIGATOR_DNT_TEST_URL, wait_for_body_text=True)

        # navigator.doNotTrack defaults to null in Chrome, "unspecified" in Firefox
        self.assertEqual(
            self.driver.find_element_by_tag_name('body').text[0:5],
            'unset',
            "navigator.DoNotTrack should have been left unset"
        )


if __name__ == "__main__":
    unittest.main()
