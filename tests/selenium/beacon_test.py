#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest


class BeaconTest(pbtest.PBSeleniumTest):
    """Tests to make sure beacon detection works as expected."""

    def test_beacon_detection(self):
        PAGE_URL = "https://www.eff.org/files/badger_test_fixtures/beacon.html"
        BEACON_DOMAIN = "dnt-test.trackersimulator.org"

        # visit the page
        self.load_url(PAGE_URL)

        # check that we detected the beacon domain as a tracker
        self.load_url(self.options_url)
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        self.driver.find_element_by_id('show-tracking-domains-checkbox').click()
        # filter the list because otherwise our slider may not be in view
        self.driver.find_element_by_id('trackingDomainSearch').send_keys(BEACON_DOMAIN)
        action = self.get_domain_slider_state(BEACON_DOMAIN)
        self.assertEqual(action, "allow",
            "Beacon domain should have been detected as a tracker")


if __name__ == "__main__":
    unittest.main()
