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

    def wait_for_page_to_start_loading(self, url, timeout=20):
        """Wait until the title element is present. Use it to work around
        Firefox not updating self.driver.current_url fast enough."""
        try:
            WebDriverWait(self.driver, timeout).until(
                expected_conditions.presence_of_element_located(
                    (By.CSS_SELECTOR, "title")))
        except TimeoutException:
            self.fail("Timed out waiting for %s to start loading" % url)

    def switch_to_new_window(self, handles_before, max_retries=5):
        """Given a set of handles, switch with retrying to the first handle
        that is not found in the original set."""

        new_handle = set(self.driver.window_handles).difference(handles_before)

        for _ in range(max_retries):
            if not new_handle:
                time.sleep(1)
                new_handle = set(self.driver.window_handles).difference(handles_before)
            else:
                break

        if not new_handle:
            self.fail("Failed to find any new window handles")

        self.driver.switch_to.window(new_handle.pop())

    def open_popup(self, close_overlay=True):
        """Open popup and optionally close overlay."""

        # TODO Hack: Open a new window to work around popup.js thinking the
        # active page is firstRun.html when popup.js checks whether the overlay
        # should be shown. Opening a new window should make the popup think
        # it's on popup.html instead. This doesn't change what happens in
        # Chrome where popup.js will keep thinking it is on popup.html.
        self.open_window()

        self.load_url(self.popup_url, wait_on_site=1)

        # hack to get tabData populated for the popup's tab
        # to get the popup shown for regular pages
        # as opposed to special (no-tabData) browser pages
        # TODO instead use a proper popup-opening function to open the popup
        # for some test page like https://www.eff.org/files/badgertest.txt;
        # for example, see https://github.com/EFForg/privacybadger/issues/1634
        self.js("""getTab(function (tab) {
  badger.recordFrame(tab.id, 0, -1, tab.url);
  refreshPopup(tab.id);
  window.DONE_REFRESHING = true;
});""")
        # wait until the async getTab function is done
        self.wait_for_script(
            "return typeof window.DONE_REFRESHING != 'undefined'",
            timeout=5,
            message="Timed out waiting for getTab() to complete."
        )

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

        EFF_URL = "https://www.eff.org/privacybadger#faq-What-is-a-third-party-tracker?"

        self.open_popup()

        try:
            trackers_link = self.driver.find_element_by_css_selector("#pbInstructions a")
        except NoSuchElementException:
            self.fail("Unable to find trackers link on popup")

        handles_before = set(self.driver.window_handles)
        trackers_link.click()

        # Make sure EFF website not opened in same window.
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        self.switch_to_new_window(handles_before)

        self.wait_for_page_to_start_loading(EFF_URL)

        self.assertEqual(self.driver.current_url, EFF_URL,
            "EFF website should open after clicking trackers link on popup")

        try:
            faq_selector = 'a[href="{}"]'.format(EFF_URL[EFF_URL.index('#'):])
            self.driver.find_element_by_css_selector(faq_selector)
        except NoSuchElementException:
            self.fail("Unable to find expected element ({}) on EFF website".format(faq_selector))

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

        EFF_URL = "https://supporters.eff.org/donate/support-privacy-badger"

        self.open_popup()

        try:
            donate_button = self.driver.find_element_by_id("donate")
        except NoSuchElementException:
            self.fail("Unable to find donate button on popup")
        handles_before = set(self.driver.window_handles)

        donate_button.click()

        # Make sure EFF website not opened in same window.
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        self.switch_to_new_window(handles_before)

        self.wait_for_page_to_start_loading(EFF_URL)

        self.assertEqual(self.driver.current_url, EFF_URL,
            "EFF website should open after clicking donate button on popup")


if __name__ == "__main__":
    unittest.main()
