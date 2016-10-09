#!/usr/bin/env python
# -*- coding: UTF-8 -*-

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

    def test_help_button(self):
        """Ensure first run page is opened when help button is clicked."""
        self.open_popup()

        try:
            help_button = self.driver.find_element_by_id("help")
        except NoSuchElementException:
            self.fail("Unable to find help button on popup")
        help_button.click()

        # Look for first run page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == pbtest.PB_CHROME_FIRST_RUN_PAGE_URL:
                return

        self.fail("First run page not opened after clicking help button on popup")


if __name__ == "__main__":
    unittest.main()
