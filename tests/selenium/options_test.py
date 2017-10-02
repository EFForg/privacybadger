#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, TimeoutException

import pbtest

class OptionsPageTest(pbtest.PBSeleniumTest):
    """Make sure the options page works correctly."""

    def select_domain_list_tab(self):
        self.driver.find_element_by_css_selector('a[href="#tab-pb-status"]').click()

    def load_options_page(self):
        self.load_url(self.bg_url)  # load a dummy page
        self.load_url(self.options_url, wait_on_site=1)

    def add_test_origin(self, origin, action):
        """Add given origin to backend storage."""
        self.load_options_page()
        self.js("badger.storage.setupHeuristicAction('{}', '{}');".format(
            origin, action))

    def test_page_title(self):
        self.load_options_page()
        localized_title = self.js('return i18n.getMessage("options_title")')
        try:
            WebDriverWait(self.driver, 3).\
                until(EC.title_contains(localized_title))
        except TimeoutException:
            self.fail("Unexpected title for the Options page. Got (%s),"
                      " expected (%s)"
                      % (self.driver.title, localized_title))

    def test_added_origin_display(self):
        """Ensure origin and tracker count is displayed."""
        self.add_test_origin("pbtest.org", "block")

        self.load_options_page()
        self.select_domain_list_tab()

        origins = self.driver.find_element_by_id("blockedResourcesInner")

        # Check tracker count.
        error_message = "Origin tracker count should be 1 after adding origin"
        self.assertEqual(
            self.driver.find_element_by_id("count").text, "1", error_message)

        # Check that origin is displayed.
        try:
            origins.find_element_by_xpath(
                './/div[@data-origin="pbtest.org"]'
                # test that "origin" is one of the classes on the element:
                # https://stackoverflow.com/a/1390680
                '//div[contains(concat(" ", normalize-space(@class), " "), " origin ") and text()="pbtest.org"]'
            )
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")

    def test_removed_origin_display(self):
        """Ensure origin is displayed and removed properly."""
        self.add_test_origin("pbtest.org", "block")

        self.load_url(self.options_url)
        self.select_domain_list_tab()

        origins = self.driver.find_element_by_id("blockedResourcesInner")

        # Remove displayed origin.
        try:
            remove_origin_element = origins.find_element_by_xpath(
                './/div[@data-origin="pbtest.org"]' +
                '//div[@class="removeOrigin"]')
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")
        remove_origin_element.click()
        # Make sure the alert is present. Otherwise we get intermittent errors.
        WebDriverWait(self.driver, 3).until(EC.alert_is_present())
        self.driver.switch_to.alert.accept()
        # Check tracker count.
        try:
            WebDriverWait(self.driver, 5).until(
                EC.text_to_be_present_in_element((By.ID, "count"), "0"))
        except TimeoutException:
            self.fail("Origin count should be 0 after deleting origin")

        # Check that no origins are displayed.
        try:
            origins = self.driver.find_element_by_id("blockedResourcesInner")
        except NoSuchElementException:
            origins = None
        error_message = "Origin should not be displayed after removal"
        self.assertIsNone(origins, error_message)


if __name__ == "__main__":
    unittest.main()
