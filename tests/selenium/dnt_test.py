#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from time import sleep

from window_utils import switch_to_window_with_url


class DNTTest(pbtest.PBSeleniumTest):
    """Tests to make sure DNT policy checking works as expected"""

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
        PAGE_URL = "https://cdn.rawgit.com/ghostwords/74585c942a918509b20bf2db5659646e/raw/f42d25717e5b4f735c7affa527a2e0b62286c005/privacy_badger_dnt_test_fixture.html"
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


if __name__ == "__main__":
    unittest.main()
