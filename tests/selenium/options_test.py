#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, TimeoutException

import pbtest


class OptionsPageTest(pbtest.PBSeleniumTest):
    """Make sure the options page works correctly."""

    def select_domain_list_tab(self):
        self.driver.find_element_by_css_selector('a[href="#tab-tracking-domains"]').click()
        self.driver.find_element_by_id('show-tracking-domains-checkbox').click()

    def select_manage_data_tab(self):
        self.driver.find_element_by_css_selector('a[href="#tab-manage-data"]').click()

    def load_options_page(self):
        self.load_url(self.bg_url)  # load a dummy page
        self.load_url(self.options_url, wait_on_site=1)

    def clear_seed_data(self):
        """Clear the seed dataset to make test checks easier"""
        self.load_options_page()
        self.js("badger.storage.resetStoredSiteData();")

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
        """Ensure origin and tracker message is displayed when there is 1 origin."""
        self.clear_seed_data()

        self.add_test_origin("pbtest.org", "block")

        self.load_options_page()
        self.select_domain_list_tab()

        error_message = "Only the 'one tracker' message should be displayed after adding an origin"
        self.assertTrue(
            self.driver.find_element_by_id("options_domain_list_one_tracker").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_no_trackers").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("pb_has_detected").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("count").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_trackers").is_displayed(), error_message)

        # Check that origin is displayed.
        origins = self.driver.find_element_by_id("blockedResourcesInner")
        try:
            origins.find_element_by_xpath(
                './/div[@data-origin="pbtest.org"]'
                # test that "origin" is one of the classes on the element:
                # https://stackoverflow.com/a/1390680
                '//div[contains(concat(" ", normalize-space(@class), " "), " origin ") and text()="pbtest.org"]'
            )
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")

    def test_added_multiple_origins_display(self):
        """Ensure origin and tracker count is displayed when there are multiple origins."""
        self.clear_seed_data()

        self.add_test_origin("pbtest.org", "block")
        self.add_test_origin("pbtest1.org", "block")

        self.load_options_page()
        self.select_domain_list_tab()

        error_message = "Only the 'multiple tracker' messages should be displayed after adding 2 origins"
        self.assertTrue(
            self.driver.find_element_by_id("pb_has_detected").is_displayed(), error_message)
        self.assertTrue(
            self.driver.find_element_by_id("count").is_displayed(), error_message)
        self.assertTrue(
            self.driver.find_element_by_id("options_domain_list_trackers").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_one_tracker").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_no_trackers").is_displayed(), error_message)

        # Check tracker count.
        error_message = "Origin tracker count should be 2 after adding origin"
        self.assertEqual(
            self.driver.find_element_by_id("count").text, "2", error_message)

        # Check those origins are displayed.
        origins = self.driver.find_element_by_id("blockedResourcesInner")
        try:
            origins.find_element_by_xpath(
                './/div[@data-origin="pbtest.org"]'
                # test that "origin" is one of the classes on the element:
                # https://stackoverflow.com/a/1390680
                '//div[contains(concat(" ", normalize-space(@class), " "), " origin ") and text()="pbtest.org"]'
            )
            origins.find_element_by_xpath(
                './/div[@data-origin="pbtest1.org"]'
                '//div[contains(concat(" ", normalize-space(@class), " "), " origin ") and text()="pbtest1.org"]'
            )
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")

    def test_removed_origin_display(self):
        """Ensure origin is removed properly."""
        self.clear_seed_data()
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

        # Check that only the 'no trackers' message is displayed.
        try:
            WebDriverWait(self.driver, 5).until(
                EC.visibility_of_element_located((By.ID, "options_domain_list_no_trackers")))
        except TimeoutException:
            self.fail("There should be a 'no trackers' message after deleting origin")

        error_message = "Only the 'no trackers' message should be displayed before adding an origin"
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_one_tracker").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("pb_has_detected").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("count").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_trackers").is_displayed(), error_message)

        # Check that no origins are displayed.
        try:
            origins = self.driver.find_element_by_id("blockedResourcesInner")
        except NoSuchElementException:
            origins = None
        error_message = "Origin should not be displayed after removal"
        self.assertIsNone(origins, error_message)

    def test_reset_data(self):
        self.load_options_page()
        self.select_domain_list_tab()

        # make sure the default tracker list includes many trackers
        error_message = "By default, the tracker list should contain many trackers"
        self.assertTrue(
            self.driver.find_element_by_id("options_domain_list_trackers").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_one_tracker").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_no_trackers").is_displayed(), error_message)

        # get the number of trackers in the seed data
        default_count = self.driver.find_element_by_id("count").text

        # Click on the "clear all data" button to empty the tracker lists, and
        # click "OK" in the popup that ensues
        self.select_manage_data_tab()
        self.driver.find_element_by_id('clearAllData').click()
        self.driver.switch_to.alert.accept()
        time.sleep(1)  # wait for page to reload

        # now make sure the tracker list is empty
        self.driver.find_element_by_css_selector('a[href="#tab-tracking-domains"]').click()
        error_message = "No trackers should be displayed after clearing all data"
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_trackers").is_displayed(), error_message)
        self.assertFalse(
            self.driver.find_element_by_id("options_domain_list_one_tracker").is_displayed(), error_message)
        self.assertTrue(
            self.driver.find_element_by_id("options_domain_list_no_trackers").is_displayed(), error_message)

        # add new blocked domains
        self.add_test_origin("pbtest.org", "block")
        self.add_test_origin("pbtest1.org", "block")

        # reload the options page
        self.load_options_page()
        self.driver.find_element_by_css_selector('a[href="#tab-tracking-domains"]').click()

        # make sure only two trackers are displayed now
        error_message = "Origin tracker count should be 2 after clearing and adding origins"
        self.assertEqual(
            self.driver.find_element_by_id("count").text, "2", error_message)

        # click the "reset data" button to restore seed data and get rid of the
        # domains we learned
        self.select_manage_data_tab()
        self.driver.find_element_by_id('resetUserData').click()
        self.driver.switch_to.alert.accept()
        time.sleep(1)

        # make sure only two trackers are displayed now
        self.driver.find_element_by_css_selector('a[href="#tab-tracking-domains"]').click()
        error_message = "After resetting data, tracker count should return to default"
        self.assertEqual(self.driver.find_element_by_id("count").text,
                         default_count, error_message)

    # early-warning check for the open_in_tab attribute of options_ui
    # https://github.com/EFForg/privacybadger/pull/1775#pullrequestreview-76940251
    def test_options_ui_open_in_tab(self):
        # open options page manually
        self.load_url(self.options_url)

        # open background page in a new window
        self.open_window()
        self.load_url(self.bg_url)

        # save open windows
        handles_before = set(self.driver.window_handles)

        # open options page using dedicated chrome API
        self.js("chrome.runtime.openOptionsPage();")

        # if we switched to the previously manually opened options page, all good
        # if we haven't, this must mean options_ui's open_in_tab no longer works
        new_handles = set(self.driver.window_handles).difference(handles_before)
        num_newly_opened_windows = len(new_handles)

        if num_newly_opened_windows:
            self.driver.switch_to.window(new_handles.pop())

        self.assertEqual(num_newly_opened_windows, 0,
            "Expected to switch to existing options page, "
            "opened a new page ({}) instead: {}".format(
                self.driver.title, self.driver.current_url))


if __name__ == "__main__":
    unittest.main()
