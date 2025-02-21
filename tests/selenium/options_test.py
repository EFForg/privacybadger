#!/usr/bin/env python

import unittest

import pytest

import pbtest

from selenium.common.exceptions import (
    NoSuchElementException,
    TimeoutException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait


class OptionsTest(pbtest.PBSeleniumTest):
    """Make sure the options page works correctly."""

    def assert_domain_toggle_state(self, domain, action, failure_msg):
        clicker = self.find_el_by_css(f'div[data-origin="{domain}"]')
        assert clicker.get_dom_attribute("class") == "clicker userset", failure_msg

        switches_div = clicker.find_element(By.CSS_SELECTOR, ".switch-container")
        assert switches_div.get_dom_attribute("class") == f"switch-container {action}", failure_msg

    def find_domain_toggle_by_xpath(self, domain):
        toggles_div = self.driver.find_element(By.ID, "blockedResourcesInner")
        return toggles_div.find_element(By.XPATH, (
            './/div[@data-origin="{domain}"]'
            # test that "origin" is one of the classes on the element:
            # https://stackoverflow.com/a/1390680
            '//div[contains(concat(" ", normalize-space(@class), " "), " origin ")]'
            '//span[text()="{domain}"]'
        ).format(domain=domain))

    def select_domain_list_tab(self):
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()

    def select_manage_data_tab(self):
        self.find_el_by_css('a[href="#tab-manage-data"]').click()

    def load_options_page(self):
        self.load_url(self.options_url + '?all')
        self.wait_for_script("return window.OPTIONS_INITIALIZED")

    def test_reloading_should_reapply_filters(self):
        FILTERVAL = "user"

        self.load_options_page()
        self.select_domain_list_tab()

        # change a domain list filter
        Select(self.find_el_by_css('#tracking-domains-type-filter')).select_by_value(FILTERVAL)

        # reload page and assert filters are set
        self.driver.refresh()
        sel = Select(self.find_el_by_css('#tracking-domains-type-filter'))
        assert sel.first_selected_option.get_property('value') == FILTERVAL

        # open options page in a new window and assert filters are not set
        self.open_window()
        self.load_options_page()
        self.select_domain_list_tab()
        sel = Select(self.find_el_by_css('#tracking-domains-type-filter'))
        assert not sel.first_selected_option.get_property('value')

    def test_adding_domain(self):
        """Ensure domain and tracker count are displayed."""
        self.clear_tracker_data()

        self.add_domain("pbtest.org", "block")

        self.load_options_page()
        self.select_domain_list_tab()

        error_message = "The 'multiple tracker' message should be displayed after adding a domain"
        assert self.driver.find_element(By.ID, "options_domain_list_trackers").is_displayed(), error_message
        assert not self.driver.find_element(By.ID, "options_domain_list_no_trackers").is_displayed(), error_message

        try:
            self.find_domain_toggle_by_xpath("pbtest.org")
        except NoSuchElementException:
            self.fail("Tracking domain is not displayed")

    def test_removing_domain(self):
        """Ensure domain is removed properly."""
        self.clear_tracker_data()
        self.add_domain("pbtest.org", "block")

        self.load_options_page()
        self.select_domain_list_tab()

        domains = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')
        assert len(domains) == 1, "Should see exactly one domain in the list"

        # remove displayed domain
        remove_domain_element = self.find_el_by_xpath(
            './/div[@data-origin="pbtest.org"]'
            '//a[@class="removeOrigin"]')
        remove_domain_element.click()

        # Make sure the alert is present. Otherwise we get intermittent errors.
        WebDriverWait(self.driver, 3).until(EC.alert_is_present())
        self.driver.switch_to.alert.accept()

        # verify that only the 'no trackers' message is displayed
        try:
            WebDriverWait(self.driver, 5).until(
                EC.visibility_of_element_located((By.ID, "options_domain_list_no_trackers")))
        except TimeoutException:
            self.fail("There should be a 'no trackers' message after deleting domain")

        error_message = "Only the 'no trackers' message should be displayed"
        assert not self.driver.find_element(By.ID, "options_domain_list_trackers").is_displayed(), error_message

        # verify that no domains are displayed
        try:
            domains = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')
        except NoSuchElementException:
            domains = []
        assert len(domains) == 0, "No domains should be displayed after removal"

    def test_reset_data(self):
        self.load_options_page()
        self.select_domain_list_tab()

        # make sure the default tracker list includes many trackers
        error_message = "By default, the tracker list should contain many trackers"
        assert self.driver.find_element(By.ID, "options_domain_list_trackers").is_displayed(), error_message
        assert not self.driver.find_element(By.ID, "options_domain_list_no_trackers").is_displayed(), error_message

        # get the number of trackers in the seed data
        default_summary_text = self.driver.find_element(By.ID, "options_domain_list_trackers").text

        # Click on the "remove all data" button to empty the tracker lists, and
        # click "OK" in the popup that ensues
        self.select_manage_data_tab()
        with self.wait_for_reload():
            self.driver.find_element(By.ID, 'removeAllData').click()
            self.driver.switch_to.alert.accept()

        # now make sure the tracker list is empty
        self.select_domain_list_tab()
        error_message = "No trackers should be displayed after removing all data"
        assert not self.driver.find_element(By.ID, "options_domain_list_trackers").is_displayed(), error_message
        assert self.driver.find_element(By.ID, "options_domain_list_no_trackers").is_displayed(), error_message

        # add new blocked domains
        self.add_domain("pbtest.org", "block")
        self.add_domain("pbtest1.org", "block")

        # reload the options page
        self.load_options_page()
        self.select_domain_list_tab()

        # make sure only two trackers are displayed now
        actual_text = self.driver.find_element(By.ID, "options_domain_list_trackers").text
        expected_text = self.js("return chrome.i18n.getMessage("
            "'options_domain_list_trackers', [2, '']);").replace("</a>", "")
        assert actual_text == expected_text

        # click the "reset data" button to restore seed data and get rid of the
        # domains we learned
        self.select_manage_data_tab()
        with self.wait_for_reload():
            self.driver.find_element(By.ID, 'resetData').click()
            self.driver.switch_to.alert.accept()

        # make sure the same number of trackers are displayed as by default
        self.select_domain_list_tab()
        error_message = "After resetting data, tracker count should return to default"
        assert self.driver.find_element(By.ID, "options_domain_list_trackers").text == default_summary_text, error_message

    def tracking_user_overwrite(self, original_action, overwrite_action):
        """Ensure preferences are persisted when a user overwrites
        PB's default behaviour for a domain."""

        DOMAIN = "pbtest.org"

        self.clear_tracker_data()
        self.add_domain(DOMAIN, original_action)

        self.load_options_page()
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        # enable learning to reveal the show-not-yet-blocked checkbox
        self.find_el_by_css('#local-learning-checkbox').click()
        self.select_domain_list_tab()
        self.find_el_by_css('#tracking-domains-show-not-yet-blocked').click()
        # wait for toggles to finish rendering
        self.wait_for_script("return window.SLIDERS_DONE")

        # Change user preferences
        domain_id = DOMAIN.replace(".", "-")
        self.wait_for_script(f"return $('#{overwrite_action}-{domain_id}')[0];")
        self.js(f"$('#{overwrite_action}-{domain_id}').trigger('click');")

        # Re-open the tab
        self.load_options_page()
        self.select_domain_list_tab()
        self.find_el_by_css('#tracking-domains-show-not-yet-blocked').click()
        # wait for toggles to finish rendering
        self.wait_for_script("return window.SLIDERS_DONE")

        # Check the user preferences for the domains are still displayed
        failure_msg = (
            f"Domain should be displayed as {overwrite_action} "
            f"after user overwrite of PB's decision to {original_action}")
        self.assert_domain_toggle_state(DOMAIN, overwrite_action, failure_msg)

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_tracking_user_overwrite_allowed_block(self):
        self.tracking_user_overwrite('allow', 'block')

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_tracking_user_overwrite_allowed_cookieblock(self):
        self.tracking_user_overwrite('allow', 'cookieblock')

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_tracking_user_overwrite_cookieblocked_allow(self):
        self.tracking_user_overwrite('cookieblock', 'allow')

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_tracking_user_overwrite_cookieblocked_block(self):
        self.tracking_user_overwrite('cookieblock', 'block')

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_tracking_user_overwrite_blocked_allow(self):
        self.tracking_user_overwrite('block', 'allow')

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_tracking_user_overwrite_blocked_cookieblock(self):
        self.tracking_user_overwrite('block', 'cookieblock')

    # early-warning check for the open_in_tab attribute of options_ui
    # https://github.com/EFForg/privacybadger/pull/1775#pullrequestreview-76940251
    def test_options_ui_open_in_tab(self):
        # open options page manually
        self.open_window()
        self.load_options_page()

        # open the new user intro page
        self.open_window()
        self.load_url(self.first_run_url)

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

        assert num_newly_opened_windows == 0, (
            "Expected to switch to existing options page, "
            f"opened a new page ({self.driver.title}) instead: "
            f"{self.driver.current_url}")


if __name__ == "__main__":
    unittest.main()
