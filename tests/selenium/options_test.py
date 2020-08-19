#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest

import pbtest

from selenium.common.exceptions import (
    ElementNotInteractableException,
    ElementNotVisibleException,
    NoSuchElementException,
    TimeoutException,
)
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from window_utils import switch_to_window_with_url


class OptionsTest(pbtest.PBSeleniumTest):
    """Make sure the options page works correctly."""

    def assert_slider_state(self, origin, action, failure_msg):
        clicker = self.driver.find_element_by_css_selector(
            'div[data-origin="{}"]'.format(origin))
        self.assertEqual(
            clicker.get_attribute("class"),
            "clicker userset",
            failure_msg
        )

        switches_div = clicker.find_element_by_css_selector(".switch-container")
        self.assertEqual(
            switches_div.get_attribute("class"),
            "switch-container " + action,
            failure_msg
        )

    def find_origin_by_xpath(self, origin):
        origins = self.driver.find_element_by_id("blockedResourcesInner")
        return origins.find_element_by_xpath((
            './/div[@data-origin="{origin}"]'
            # test that "origin" is one of the classes on the element:
            # https://stackoverflow.com/a/1390680
            '//div[contains(concat(" ", normalize-space(@class), " "), " origin ")]'
            '//span[text()="{origin}"]'
        ).format(origin=origin))

    def select_domain_list_tab(self):
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        try:
            self.driver.find_element_by_id('show-tracking-domains-checkbox').click()
        except (ElementNotInteractableException, ElementNotVisibleException):
            # The list will be loaded directly if we're opening the tab for the second time in this test
            pass

    def select_manage_data_tab(self):
        self.find_el_by_css('a[href="#tab-manage-data"]').click()

    def check_tracker_messages(self, error_message, many, one, none):
        self.assertEqual(many,
            self.driver.find_element_by_id("options_domain_list_trackers").is_displayed(), error_message)
        self.assertEqual(one,
            self.driver.find_element_by_id("options_domain_list_one_tracker").is_displayed(), error_message)
        self.assertEqual(none,
            self.driver.find_element_by_id("options_domain_list_no_trackers").is_displayed(), error_message)

    def load_options_page(self):
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")

    def clear_seed_data(self):
        """Clear the seed dataset to make test checks easier"""
        self.load_options_page()
        self.js("chrome.extension.getBackgroundPage().badger.storage.clearTrackerData();")

    def add_test_origin(self, origin, action):
        """Add given origin to backend storage."""
        self.load_options_page()
        self.js((
            "chrome.extension.getBackgroundPage()"
            ".badger.storage.setupHeuristicAction('{}', '{}');"
        ).format(origin, action))

    def user_overwrite(self, origin, action):
        # Get the slider that corresponds to this radio button
        origin_div = self.find_el_by_css('div[data-origin="' + origin + '"]')
        slider = origin_div.find_element_by_css_selector('.switch-toggle')

        # Click on the correct place over the slider to block this origin
        click_action = ActionChains(self.driver)
        if action == 'block':
            # Top left (+2px)
            click_action.move_to_element_with_offset(slider, 2, 2)
        if action == 'cookieblock':
            # Top middle
            click_action.move_to_element_with_offset(slider, slider.size['width']/2, 2)
        if action == 'allow':
            # Top right
            click_action.move_to_element_with_offset(slider, slider.size['width']-2, 2)
        click_action.click()
        click_action.perform()

    def test_page_title(self):
        self.load_options_page()
        localized_title = self.js('return chrome.i18n.getMessage("options_title")')
        try:
            WebDriverWait(self.driver, 3).until(
                EC.title_contains(localized_title))
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
        self.check_tracker_messages(error_message, many=False, one=True, none=False)

        try:
            self.find_origin_by_xpath("pbtest.org")
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
        self.check_tracker_messages(error_message, many=True, one=False, none=False)

        # check tracker count
        self.assertEqual(
            self.driver.find_element_by_id("options_domain_list_trackers").text,
            "Privacy Badger has detected 2 potential tracking domains so far.",
            "Origin tracker count should be 2 after adding origin"
        )

        # Check those origins are displayed.
        try:
            self.find_origin_by_xpath("pbtest.org")
            self.find_origin_by_xpath("pbtest1.org")
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")

    def test_removed_origin_display(self):
        """Ensure origin is removed properly."""
        self.clear_seed_data()
        self.add_test_origin("pbtest.org", "block")

        self.load_options_page()
        self.select_domain_list_tab()

        # Remove displayed origin.
        remove_origin_element = self.find_el_by_xpath(
            './/div[@data-origin="pbtest.org"]'
            '//a[@class="removeOrigin"]')
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
        self.check_tracker_messages(error_message, many=True, one=False, none=False)

        # get the number of trackers in the seed data
        default_summary_text = self.driver.find_element_by_id("options_domain_list_trackers").text

        # Click on the "remove all data" button to empty the tracker lists, and
        # click "OK" in the popup that ensues
        self.select_manage_data_tab()
        self.driver.find_element_by_id('removeAllData').click()
        self.driver.switch_to.alert.accept()
        time.sleep(1)  # wait for page to reload

        # now make sure the tracker list is empty
        self.select_domain_list_tab()
        error_message = "No trackers should be displayed after removing all data"
        self.check_tracker_messages(error_message, many=False, one=False, none=True)

        # add new blocked domains
        self.add_test_origin("pbtest.org", "block")
        self.add_test_origin("pbtest1.org", "block")

        # reload the options page
        self.load_options_page()
        self.select_domain_list_tab()

        # make sure only two trackers are displayed now
        self.assertEqual(
            self.driver.find_element_by_id("options_domain_list_trackers").text,
            "Privacy Badger has detected 2 potential tracking domains so far.",
            "Origin tracker count should be 2 after clearing and adding origins"
        )

        # click the "reset data" button to restore seed data and get rid of the
        # domains we learned
        self.select_manage_data_tab()
        self.driver.find_element_by_id('resetData').click()
        self.driver.switch_to.alert.accept()
        time.sleep(1)

        # make sure the same number of trackers are displayed as by default
        self.select_domain_list_tab()
        error_message = "After resetting data, tracker count should return to default"
        self.assertEqual(self.driver.find_element_by_id("options_domain_list_trackers").text,
                         default_summary_text, error_message)

    def tracking_user_overwrite(self, original_action, overwrite_action):
        """Ensure preferences are persisted when a user overwrites pb's default behaviour for an origin."""
        self.clear_seed_data()
        self.add_test_origin("pbtest.org", original_action)

        self.load_options_page()
        self.select_domain_list_tab()
        self.find_el_by_css('#tracking-domains-show-not-yet-blocked').click()
        # wait for sliders to finish rendering
        self.wait_for_script("return window.SLIDERS_DONE")

        # Change user preferences
        self.user_overwrite("pbtest.org", overwrite_action)

        # Re-open the tab
        self.load_options_page()
        self.select_domain_list_tab()
        self.find_el_by_css('#tracking-domains-show-not-yet-blocked').click()
        # wait for sliders to finish rendering
        self.wait_for_script("return window.SLIDERS_DONE")

        # Check the user preferences for the origins are still displayed
        failure_msg = (
            "Origin should be displayed as {} after user overwrite of "
            "PB's decision to {}".format(overwrite_action, original_action)
        )
        self.assert_slider_state("pbtest.org", overwrite_action, failure_msg)

    def test_tracking_user_overwrite_allowed_block(self):
        self.tracking_user_overwrite('allow', 'block')

    def test_tracking_user_overwrite_allowed_cookieblock(self):
        self.tracking_user_overwrite('allow', 'cookieblock')

    def test_tracking_user_overwrite_cookieblocked_allow(self):
        self.tracking_user_overwrite('cookieblock', 'allow')

    def test_tracking_user_overwrite_cookieblocked_block(self):
        self.tracking_user_overwrite('cookieblock', 'block')

    def test_tracking_user_overwrite_blocked_allow(self):
        self.tracking_user_overwrite('block', 'allow')

    def test_tracking_user_overwrite_blocked_cookieblock(self):
        self.tracking_user_overwrite('block', 'cookieblock')

    # early-warning check for the open_in_tab attribute of options_ui
    # https://github.com/EFForg/privacybadger/pull/1775#pullrequestreview-76940251
    def test_options_ui_open_in_tab(self):
        # open options page manually, keeping the new user intro page
        self.open_window()
        self.load_options_page()

        # switch to new user intro page
        switch_to_window_with_url(self.driver, self.first_run_url)

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
