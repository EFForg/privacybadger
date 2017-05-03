#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest
import pbtest
from selenium.common.exceptions import (
    NoSuchElementException, StaleElementReferenceException, TimeoutException)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait


class PopupTest(pbtest.PBSeleniumTest):
    """Make sure the popup works correctly."""

    def open_popup(self, close_overlay=True):
        """Open popup and optionally close overlay."""
        self.load_url(self.popup_url, wait_on_site=1)
        if close_overlay:
            # Click 'X' element to close overlay.
            try:
                close_element = self.driver.find_element_by_id("fittslaw")
            except NoSuchElementException:
                self.fail("Unable to find element to close popup overlay")
            close_element.click()

            # Element will fade out so wait for it to disappear.
            try:
                WebDriverWait(self.driver, 5).until(
                    expected_conditions.invisibility_of_element_located(
                        (By.ID, "fittslaw")))
            except TimeoutException:
                self.fail("Unable to close popup overlay")

    def get_enable_button(self):
        """Get enable button on popup."""
        try:
            return self.driver.find_element_by_id("activate_site_btn")
        except NoSuchElementException:
            self.fail("Unable to find enable button on poup")

    def get_disable_button(self):
        """Get disable button on popup."""
        try:
            return self.driver.find_element_by_id("deactivate_site_btn")
        except NoSuchElementException:
            self.fail("Unable to find disable buttons on popup")

    def test_overlay(self):
        """Ensure overlay links to first run comic."""
        self.open_popup(close_overlay=False)

        try:
            comic_link = self.driver.find_element_by_id("firstRun")
        except NoSuchElementException:
            self.fail("Unable to find link to comic on popup overlay")
        comic_link.click()

        # Make sure first run comic not opened in same window.
        time.sleep(1)
        if self.driver.current_url != self.popup_url:
            self.fail("First run comic not opened in new window")

        # Look for first run page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url.startswith(self.first_run_url):
                return

        self.fail("First run comic not opened after clicking link in popup overlay")

    def test_help_button(self):
        """Ensure first run page is opened when help button is clicked."""
        self.open_popup()

        try:
            help_button = self.driver.find_element_by_id("help")
        except NoSuchElementException:
            self.fail("Unable to find help button on popup")
        help_button.click()

        # Make sure first run page not opened in same window.
        time.sleep(1)
        if self.driver.current_url != self.popup_url:
            self.fail("Options page not opened in new window")

        # Look for first run page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == self.first_run_url:
                return

        self.fail("Options page not opened after clicking help button on popup")

    def test_options_button(self):
        """Ensure options page is opened when button is clicked."""
        self.open_popup()

        try:
            options_button = self.driver.find_element_by_id("options")
        except NoSuchElementException:
            self.fail("Unable to find options button on popup")
        options_button.click()

        # Make sure options page not opened in same window.
        time.sleep(1)
        if self.driver.current_url != self.popup_url:
            self.fail("Options page not opened in new window")

        # Look for options page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == self.popup_url:
                return

        self.fail("Options page not opened after clicking options button on popup")

    def test_trackers_link(self):
        """Ensure trackers link opens EFF website."""
        self.open_popup()

        try:
            trackers_link = self.driver.find_element_by_link_text("trackers")
        except NoSuchElementException:
            self.fail("Unable to find trackers link on popup")

        handles_before = set(self.driver.window_handles)
        trackers_link.click()

        # Make sure EFF website not opened in same window.
        time.sleep(5)
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        new_handle = set(self.driver.window_handles).difference(handles_before)
        self.driver.switch_to_window(new_handle.pop())

        eff_url = "https://www.eff.org/privacybadger#faq-What-is-a-third-party-tracker?"
        self.assertEqual(self.driver.current_url, eff_url,
            "EFF website should open after clicking donate button on popup")

    def test_disable_enable_buttons(self):
        """Ensure disable/enable buttons change popup state."""
        self.open_popup()

        disable_button = self.get_disable_button()
        disable_button.click()

        WebDriverWait(self.driver, 3).until(
            expected_conditions.presence_of_element_located(
                (By.ID, "deactivate_site_btn")))

        displayed_error = " should not be displayed on popup"
        not_displayed_error = " should be displayed on popup"

        # Check that popup state changed after disabling.
        disable_button = self.get_disable_button()
        self.assertFalse(disable_button.is_displayed(),
                         "Disable button" + displayed_error)
        enable_button = self.get_enable_button()
        self.assertTrue(enable_button.is_displayed(),
                        "Enable button" + not_displayed_error)

        enable_button.click()

        WebDriverWait(self.driver, 3).until(
            expected_conditions.presence_of_element_located(
                (By.ID, "activate_site_btn")))

        # Check that popup state changed after re-enabling.
        disable_button = self.get_disable_button()
        self.assertTrue(disable_button.is_displayed(),
                        "Disable button" + not_displayed_error)
        enable_button = self.get_enable_button()
        self.assertFalse(enable_button.is_displayed(),
                         "Enable button" + displayed_error)
    def test_error_button(self):
        """Ensure error button opens report error overlay."""
        self.open_popup()

        # TODO: selenium firefox has a bug where is_displayed() is always True
        # for these elements. But we should use is_displayed when this is fixed.
        #overlay_input = self.driver.find_element_by_id("error_input")
        #self.assertTrue(overlay_input.is_displayed(), "User input" + error_message)

        # assert error reporting menu is not open
        self.assertTrue(len(self.driver.find_elements_by_class_name('active')) == 0,
                'error reporting should not be open')

        # Click error button to open overlay for reporting sites.
        error_button = self.driver.find_element_by_id("error")
        error_button.click()
        time.sleep(1)

        # check error is open
        self.assertTrue(len(self.driver.find_elements_by_class_name('active')) == 1,
                'error reporting should be open')

        overlay_close = self.driver.find_element_by_id("report_close")
        overlay_close.click()
        time.sleep(1)
        self.assertTrue(len(self.driver.find_elements_by_class_name('active')) == 0,
                'error reporting should be closed again')

    def test_donate_button(self):
        """Ensure donate button opens EFF website."""
        self.open_popup()

        try:
            donate_button = self.driver.find_element_by_id("donate")
        except NoSuchElementException:
            self.fail("Unable to find donate button on popup")
        handles_before = set(self.driver.window_handles)

        donate_button.click()

        # Make sure EFF website not opened in same window.
        time.sleep(5)
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        new_handle = set(self.driver.window_handles).difference(handles_before)
        self.driver.switch_to_window(new_handle.pop())

        eff_url = "https://supporters.eff.org/donate/support-privacy-badger"
        self.assertEqual(self.driver.current_url, eff_url,
            "EFF website should open after clicking donate button on popup")


if __name__ == "__main__":
    unittest.main()
