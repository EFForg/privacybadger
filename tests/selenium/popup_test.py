#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest
import pbtest
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait


class PopupTest(pbtest.PBSeleniumTest):
    """Make sure the popup works correctly."""

    def open_popup(self, close_overlay=True):
        """Open popup and optionally close overlay."""
        self.load_url(pbtest.PB_CHROME_POPUP_URL, wait_on_site=1)
        if close_overlay:
            # Click 'X' element to close overlay.
            try:
                close_element = self.driver.find_element_by_id("fittslaw")
            except NoSuchElementException:
                self.fail("Unable to find element to close popup overlay")
            close_element.click()

            # Element will fade out so wait for it to disappear.
            try:
                WebDriverWait(self.driver, 3).until(
                    expected_conditions.invisibility_of_element_located(
                        (By.ID, "fittslaw")))
            except TimeoutException:
                self.fail("Unable to close popup overlay")

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
        if self.driver.current_url != pbtest.PB_CHROME_POPUP_URL:
            self.fail("First run comic not opened in new window")

        # Look for first run page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url.startswith(pbtest.PB_CHROME_FIRST_RUN_PAGE_URL):
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
        if self.driver.current_url != pbtest.PB_CHROME_POPUP_URL:
            self.fail("Options page not opened in new window")

        # Look for first run page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == pbtest.PB_CHROME_FIRST_RUN_PAGE_URL:
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
        if self.driver.current_url != pbtest.PB_CHROME_POPUP_URL:
            self.fail("Options page not opened in new window")

        # Look for options page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == pbtest.PB_CHROME_OPTIONS_PAGE_URL:
                return

        self.fail("Options page not opened after clicking options button on popup")

    def test_trackers_link(self):
        """Ensure trackers link opens EFF website."""
        self.open_popup()

        try:
            trackers_link = self.driver.find_element_by_link_text("trackers")
        except NoSuchElementException:
            self.fail("Unable to find trackers link on popup")
        trackers_link.click()

        # Make sure EFF website not opened in same window.
        time.sleep(1)
        if self.driver.current_url != pbtest.PB_CHROME_POPUP_URL:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        eff_url = "https://www.eff.org/privacybadger#trackers"
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == eff_url:
                return

        self.fail("EFF website not opened after clicking trackers link")

    def test_donate_button(self):
        """Ensure donate button opens EFF website."""
        self.open_popup()

        try:
            donate_button = self.driver.find_element_by_id("donate")
        except NoSuchElementException:
            self.fail("Unable to find donate button on popup")
        donate_button.click()

        # Make sure EFF website not opened in same window.
        time.sleep(1)
        if self.driver.current_url != pbtest.PB_CHROME_POPUP_URL:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        eff_url = "https://supporters.eff.org/donate/support-privacy-badger"
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == eff_url:
                return

        self.fail("EFF website not opened after clicking donate button on popup")


if __name__ == "__main__":
    unittest.main()
