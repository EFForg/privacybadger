#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import json
import time
import unittest

import pbtest

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

from window_utils import switch_to_window_with_url


def get_domain_slider_state(driver, domain):
    label = driver.find_element_by_css_selector(
        'input[name="{}"][checked] + label'.format(domain))
    return label.get_attribute('data-action')


class PopupTest(pbtest.PBSeleniumTest):
    """Make sure the popup works correctly."""

    def clear_seed_data(self):
        self.load_url(self.options_url)
        self.js("chrome.extension.getBackgroundPage().badger.storage.clearTrackerData();")

    def wait_for_page_to_start_loading(self, url, timeout=20):
        """Wait until the title element is present. Use it to work around
        Firefox not updating self.driver.current_url fast enough."""
        try:
            WebDriverWait(self.driver, timeout).until(
                expected_conditions.presence_of_element_located(
                    (By.CSS_SELECTOR, "title")))
        except TimeoutException:
            # TODO debug info
            print("\n")
            print("driver.current_url=" + self.driver.current_url)
            print()
            print(self.driver.page_source[:5000])
            print("...\n")

            self.fail("Timed out waiting for %s to start loading" % url)

    def open_popup(self, close_overlay=True, origins=None):
        """Open popup and optionally close overlay."""

        # TODO Hack: Open a new window to work around popup.js thinking the
        # active page is firstRun.html when popup.js checks whether the overlay
        # should be shown. Opening a new window should make the popup think
        # it's on popup.html instead. This doesn't change what happens in
        # Chrome where popup.js will keep thinking it is on popup.html.
        self.open_window()

        self.load_url(self.popup_url)
        self.wait_for_script("return window.POPUP_INITIALIZED")

        # hack to get tabData populated for the popup's tab
        # to get the popup shown for regular pages
        # as opposed to special (no-tabData) browser pages
        # TODO instead use a proper popup-opening function to open the popup
        # for some test page like https://www.eff.org/files/badgertest.txt;
        # for example, see https://github.com/EFForg/privacybadger/issues/1634
        js = """getTab(function (tab) {
  chrome.runtime.sendMessage({
    type: "getPopupData",
    tabId: tab.id,
    tabUrl: tab.url
  }, (response) => {
    response.noTabData = false;
    response.origins = %s;
    setPopupData(response);
    refreshPopup();
    window.DONE_REFRESHING = true;
  });
});"""
        js = js % (
            json.dumps(origins) if origins else "{}",
        )
        self.js(js)
        # wait until the async getTab function is done
        self.wait_for_script(
            "return typeof window.DONE_REFRESHING != 'undefined'",
            timeout=5,
            message="Timed out waiting for getTab() to complete."
        )

        # wait for any sliders to finish rendering
        self.wait_for_script("return window.SLIDERS_DONE")

        if close_overlay:
            # Click 'X' element to close overlay.
            close_element = self.driver.find_element_by_id("fittslaw")
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
        return self.driver.find_element_by_id("activate_site_btn")

    def get_disable_button(self):
        """Get disable button on popup."""
        return self.driver.find_element_by_id("deactivate_site_btn")

    def test_overlay(self):
        """Ensure overlay links to first run comic."""
        self.open_popup(close_overlay=False)

        self.driver.find_element_by_id("firstRun").click()

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

        self.driver.find_element_by_id("help").click()

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

        self.driver.find_element_by_id("options").click()

        # Make sure options page not opened in same window.
        time.sleep(1)
        if self.driver.current_url != self.popup_url:
            self.fail("Options page not opened in new window")

        # Look for options page and return if found.
        for window in self.driver.window_handles:
            self.driver.switch_to.window(window)
            if self.driver.current_url == self.options_url:
                return

        self.fail("Options page not opened after clicking options button on popup")

    @pbtest.repeat_if_failed(5)
    def test_trackers_link(self):
        """Ensure trackers link opens EFF website."""

        EFF_URL = "https://www.eff.org/privacybadger/faq#What-is-a-third-party-tracker"

        self.open_popup()

        # Get all possible tracker links (none, one, multiple)
        trackers_links = self.driver.find_elements_by_css_selector("#pbInstructions a")
        if not trackers_links:
            self.fail("Unable to find trackers link on popup")

        # Get the one that's displayed on the page that this test is using
        for link in trackers_links:
            if link.is_displayed():
                trackers_link = link

        trackers_link.click()

        # Make sure EFF website not opened in same window.
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        switch_to_window_with_url(self.driver, EFF_URL)

        self.wait_for_page_to_start_loading(EFF_URL)

        self.assertEqual(self.driver.current_url, EFF_URL,
            "EFF website should open after clicking trackers link on popup")

        # Verify EFF website contains the linked anchor element.
        faq_selector = 'a[href="{}"]'.format(EFF_URL[EFF_URL.index('#'):])
        try:
            WebDriverWait(self.driver, pbtest.SEL_DEFAULT_WAIT_TIMEOUT).until(
                expected_conditions.presence_of_element_located(
                    (By.CSS_SELECTOR, faq_selector)))
        except TimeoutException:
            self.fail("Unable to find expected element ({}) on EFF website".format(faq_selector))

    def test_toggling_sliders(self):
        """Ensure toggling sliders is persisted."""
        self.clear_seed_data()

        DOMAIN = "example.com"
        DOMAIN_ID = DOMAIN.replace(".", "-")

        self.open_popup(origins={DOMAIN:"allow"})

        # click input with JavaScript to avoid "Element ... is not clickable" /
        # "Other element would receive the click" Selenium limitation
        self.js("$('#block-{}').click()".format(DOMAIN_ID))

        # retrieve the new action
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        new_action = get_domain_slider_state(self.driver, DOMAIN)

        self.assertEqual(new_action, "block",
            "The domain should be blocked on options page.")

        # test toggling some more
        self.open_popup(close_overlay=False, origins={DOMAIN:"user_block"})

        self.assertTrue(
            self.driver.find_element_by_id("block-" + DOMAIN_ID).is_selected(),
            "The domain should be shown as blocked in popup."
        )

        # change to "cookieblock"
        self.js("$('#cookieblock-{}').click()".format(DOMAIN_ID))
        # change again to "block"
        self.js("$('#block-{}').click()".format(DOMAIN_ID))

        # retrieve the new action
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        new_action = get_domain_slider_state(self.driver, DOMAIN)

        self.assertEqual(new_action, "block",
            "The domain should still be blocked on options page.")

    def test_reverting_control(self):
        """Test restoring control of a domain to Privacy Badger."""
        self.clear_seed_data()

        DOMAIN = "example.com"
        DOMAIN_ID = DOMAIN.replace(".", "-")

        # record the domain as cookieblocked by Badger
        self.load_url(self.options_url)
        self.js((
            "chrome.extension.getBackgroundPage()"
            ".badger.storage.setupHeuristicAction('{}', '{}');"
        ).format(DOMAIN, "cookieblock"))

        self.open_popup(origins={DOMAIN:"cookieblock"})

        # set the domain to user control
        # click input with JavaScript to avoid "Element ... is not clickable" /
        # "Other element would receive the click" Selenium limitation
        self.js("$('#block-{}').click()".format(DOMAIN_ID))

        # restore control to Badger
        self.driver.find_element_by_css_selector(
            'div[data-origin="{}"] div.honeybadgerPowered'.format(DOMAIN)
        ).click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])

        # verify the domain is no longer user controlled
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()

        # assert the action is not what we manually clicked
        action = get_domain_slider_state(self.driver, DOMAIN)
        self.assertEqual(action, "cookieblock",
            "Domain's action should have been restored.")

        # assert the undo arrow is not displayed
        self.driver.find_element_by_css_selector('a[href="#tab-tracking-domains"]').click()
        self.driver.find_element_by_id('show-tracking-domains-checkbox').click()
        self.assertFalse(
            self.driver.find_element_by_css_selector(
                'div[data-origin="{}"] div.honeybadgerPowered'.format(DOMAIN)
            ).is_displayed(),
            "Undo arrow should not be displayed."
        )

    def test_disable_enable_buttons(self):
        """Ensure disable/enable buttons change popup state."""

        DISPLAYED_ERROR = " should not be displayed on popup"
        NOT_DISPLAYED_ERROR = " should be displayed on popup"

        self.open_popup()

        self.get_disable_button().click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])
        self.open_popup(close_overlay=False)

        # Check that popup state changed after disabling.
        disable_button = self.get_disable_button()
        self.assertFalse(disable_button.is_displayed(),
                         "Disable button" + DISPLAYED_ERROR)
        enable_button = self.get_enable_button()
        self.assertTrue(enable_button.is_displayed(),
                        "Enable button" + NOT_DISPLAYED_ERROR)

        enable_button.click()

        self.driver.switch_to.window(self.driver.window_handles[0])
        self.open_popup(close_overlay=False)

        # Check that popup state changed after re-enabling.
        disable_button = self.get_disable_button()
        self.assertTrue(disable_button.is_displayed(),
                        "Disable button" + NOT_DISPLAYED_ERROR)
        enable_button = self.get_enable_button()
        self.assertFalse(enable_button.is_displayed(),
                         "Enable button" + DISPLAYED_ERROR)

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

    @pbtest.repeat_if_failed(5)
    def test_donate_button(self):
        """Ensure donate button opens EFF website."""

        EFF_URL = "https://supporters.eff.org/donate/support-privacy-badger"

        self.open_popup()

        donate_button = self.driver.find_element_by_id("donate")

        donate_button.click()

        # Make sure EFF website not opened in same window.
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        switch_to_window_with_url(self.driver, EFF_URL)

        self.wait_for_page_to_start_loading(EFF_URL)

        self.assertEqual(self.driver.current_url, EFF_URL,
            "EFF website should open after clicking donate button on popup")


if __name__ == "__main__":
    unittest.main()
