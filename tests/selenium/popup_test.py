#!/usr/bin/env python

import time
import unittest

import pytest

import pbtest

from selenium.common.exceptions import TimeoutException
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
            # TODO debug info
            print("\n")
            print("driver.current_url=" + self.driver.current_url)
            print()
            print(self.driver.page_source[:5000])
            print("...\n")

            self.fail(f"Timed out waiting for {url} to start loading")

    @pytest.mark.flaky(reruns=3, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_welcome_page_reminder_overlay(self):
        """Ensure overlay links to new user welcome page."""

        # first close the welcome page if already open
        try:
            self.close_window_with_url(self.first_run_url, max_tries=1)
        except pbtest.WindowNotFoundException:
            pass

        self.open_popup(show_reminder=True)
        self.driver.find_element(By.ID, "intro-reminder-btn").click()

        # switch to the welcome page or fail
        if pbtest.shim.browser_type in ("chrome", "edge"):
            # work around some kind of Chromium race condition bug
            time.sleep(1)
        self.switch_to_window_with_url(self.first_run_url)

    def test_help_button(self):
        """Ensure FAQ website is opened when help button is clicked."""

        FAQ_URL = "https://privacybadger.org/#faq"

        try:
            self.switch_to_window_with_url(FAQ_URL, max_tries=1)
        except pbtest.WindowNotFoundException:
            pass
        else:
            self.fail("FAQ should not already be open")

        self.open_popup()
        self.driver.find_element(By.ID, "help").click()

        self.switch_to_window_with_url(FAQ_URL)

    def test_options_button(self):
        """Ensure options page is opened when button is clicked."""
        # first close the options page if already open
        try:
            self.switch_to_window_with_url(self.options_url, max_tries=1)
            self.open_window()
            self.switch_to_window_with_url(self.options_url)
            self.driver.close()
            self.driver.switch_to.window(self.driver.window_handles[0])
        except pbtest.WindowNotFoundException:
            pass
        self.open_popup()
        self.driver.find_element(By.ID, "options").click()
        self.switch_to_window_with_url(self.options_url)

    def test_trackers_link(self):
        """Ensure trackers link opens EFF website."""

        EFF_URL = "https://privacybadger.org/#What-is-a-third-party-tracker"
        DUMMY_PAGE_URL = "https://privacybadger-tests.eff.org/html/widget_frame.html"

        self.load_url(DUMMY_PAGE_URL)
        self.open_popup(DUMMY_PAGE_URL)
        self.driver.find_element(By.CSS_SELECTOR, "#instructions-no-trackers a").click()

        # Make sure EFF website not opened in same window.
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        # Look for EFF website and return if found.
        self.switch_to_window_with_url(EFF_URL)

        self.wait_for_page_to_start_loading(EFF_URL)

        assert self.driver.current_url == EFF_URL, (
            "EFF website should open after clicking trackers link on popup")

        # Verify EFF website contains the linked anchor element.
        faq_selector = f"a[href='{EFF_URL[EFF_URL.index('#'):]}']"
        try:
            WebDriverWait(self.driver, pbtest.SEL_DEFAULT_WAIT_TIMEOUT).until(
                expected_conditions.presence_of_element_located(
                    (By.CSS_SELECTOR, faq_selector)))
        except TimeoutException:
            self.fail(f"Unable to find expected element ({faq_selector}) on EFF website")

    def test_toggling_sliders(self):
        """Ensure toggling sliders is persisted."""

        FIXTURE_URL = ("https://privacybadger-tests.eff.org/html/"
            "assorted_thirdparties.html")
        DOMAIN = "efforg.github.io"
        DOMAIN_ID = DOMAIN.replace(".", "-")

        self.clear_tracker_data()

        # enable showing non-tracking domains in the popup
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()
        self.find_el_by_css('#show-nontracking-domains-checkbox').click()

        self.load_url(FIXTURE_URL)
        self.open_popup(FIXTURE_URL)

        # click input with JavaScript to avoid "Element ... is not clickable" /
        # "Other element would receive the click" Selenium limitation
        self.js(f"$('#block-{DOMAIN_ID}').click()")

        # retrieve the new action
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        assert self.get_domain_slider_state(DOMAIN) == "block", (
            "The domain should be blocked on options page")

        self.open_popup(FIXTURE_URL)
        assert self.driver.find_element(By.ID, "block-" + DOMAIN_ID).is_selected(), (
            "The domain should be shown as blocked in popup")

        # change to "cookieblock"
        self.js(f"$('#cookieblock-{DOMAIN_ID}').click()")
        # change again to "block"
        self.js(f"$('#block-{DOMAIN_ID}').click()")

        # retrieve the new action
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        assert self.get_domain_slider_state(DOMAIN) == "block", (
            "The domain should still be blocked on options page")

    def test_reverting_control(self):
        """Test restoring control of a domain to Privacy Badger."""

        FIXTURE_URL = ("https://privacybadger-tests.eff.org/html/"
            "assorted_thirdparties.html")
        DOMAIN = "efforg.github.io"
        DOMAIN_ID = DOMAIN.replace(".", "-")

        self.clear_tracker_data()

        # record the domain as cookieblocked by Badger
        self.cookieblock_domain(DOMAIN)

        self.load_url(FIXTURE_URL)
        self.open_popup(FIXTURE_URL)

        # reveal sliders
        self.driver.find_element(By.ID, 'expand-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # set the domain to user control
        # click input with JavaScript to avoid "Element ... is not clickable" /
        # "Other element would receive the click" Selenium limitation
        self.js(f"$('#block-{DOMAIN_ID}').click()")

        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        action = self.get_domain_slider_state(DOMAIN)
        assert action == "block", "Domain should be marked as blocked"
        assert self.driver.find_element(By.CSS_SELECTOR,
            f'div[data-origin="{DOMAIN}"] a.honeybadgerPowered').is_displayed(), (
                "Undo arrow should be displayed")

        # restore control to Badger
        self.open_popup(FIXTURE_URL)
        with self.wait_for_window_close():
            self.driver.find_element(By.CSS_SELECTOR,
                f'div[data-origin="{DOMAIN}"] a.honeybadgerPowered').click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])

        # verify the domain is no longer user controlled
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()
        action = self.get_domain_slider_state(DOMAIN)
        assert action == "cookieblock", "Domain's action should have been restored"
        assert not self.driver.find_element(By.CSS_SELECTOR,
            f'div[data-origin="{DOMAIN}"] a.honeybadgerPowered').is_displayed(), (
                "Undo arrow should not be displayed")

    def test_disable_enable_buttons(self):
        """Ensure disable/enable buttons change popup state."""

        def get_enable_button():
            return self.driver.find_element(By.ID, "activate_site_btn")

        def get_disable_button():
            return self.driver.find_element(By.ID, "deactivate_site_btn")

        DISPLAYED_ERROR = " should not be displayed on popup"
        NOT_DISPLAYED_ERROR = " should be displayed on popup"
        DUMMY_PAGE_URL = "https://privacybadger-tests.eff.org/html/widget_frame.html"

        self.load_url(DUMMY_PAGE_URL)
        self.open_popup(DUMMY_PAGE_URL)
        get_disable_button().click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])
        self.open_popup(DUMMY_PAGE_URL)

        # Check that popup state changed after disabling.
        disable_button = get_disable_button()
        assert not disable_button.is_displayed(), (
            "Disable button" + DISPLAYED_ERROR)
        enable_button = get_enable_button()
        assert enable_button.is_displayed(), (
            "Enable button" + NOT_DISPLAYED_ERROR)

        enable_button.click()

        self.driver.switch_to.window(self.driver.window_handles[0])
        self.open_popup(DUMMY_PAGE_URL)

        # Check that popup state changed after re-enabling.
        disable_button = get_disable_button()
        assert disable_button.is_displayed(), "Disable button" + NOT_DISPLAYED_ERROR
        enable_button = get_enable_button()
        assert not enable_button.is_displayed(), "Enable button" + DISPLAYED_ERROR

    def test_error_button(self):
        """Ensure error button opens report error overlay."""

        DUMMY_PAGE_URL = "https://privacybadger-tests.eff.org/html/widget_frame.html"
        self.load_url(DUMMY_PAGE_URL)
        self.open_popup(DUMMY_PAGE_URL)

        report_input = self.driver.find_element(By.ID, "error_input")
        assert not report_input.is_displayed(), (
            "Error reporting should be closed by default")

        # click the "Report broken site" button
        self.driver.find_element(By.ID, "error").click()
        time.sleep(1)
        assert report_input.is_displayed(), (
            "Error reporting should be open")

        self.driver.find_element(By.ID, "report_close").click()
        time.sleep(1)
        assert not report_input.is_displayed(), (
            "Error reporting should have gotten closed")

        # verify saving and restoring in-progress reports
        ERROR_REPORT_TEXT = "The site isn't loading"
        self.driver.find_element(By.ID, "error").click()
        time.sleep(1)
        report_input.send_keys(ERROR_REPORT_TEXT)
        self.driver.close()
        self.driver.switch_to.window(self.driver.window_handles[0])
        self.open_popup(DUMMY_PAGE_URL)
        time.sleep(1)
        report_input = self.driver.find_element(By.ID, "error_input")
        assert report_input.is_displayed(), "Error reporting should be open"
        assert report_input.get_attribute('value') == ERROR_REPORT_TEXT, (
            "Previously entered text should be displayed")

    def test_donate_button(self):
        """Ensure donate button opens EFF website."""

        EFF_URL = "https://supporters.eff.org/donate/support-privacy-badger"

        self.open_popup()
        self.driver.find_element(By.ID, "donate").click()

        # make sure EFF website not opened in same window
        if self.driver.current_url != self.popup_url:
            self.fail("EFF website not opened in new window")

        self.switch_to_window_with_url(EFF_URL)
        self.wait_for_page_to_start_loading(EFF_URL)
        assert self.driver.current_url == EFF_URL, (
            "EFF website should open after clicking donate button on popup")

    def test_breakage_warnings(self):
        YLIST_DOMAIN = "code.jquery.com"
        FIXTURE_URL = ("https://privacybadger-tests.eff.org/html/"
            "assorted_thirdparties.html")
        self.cookieblock_domain(YLIST_DOMAIN)

        self.load_url(FIXTURE_URL)
        self.open_popup(FIXTURE_URL)

        def get_breakage_icon():
            return self.driver.find_element(By.CSS_SELECTOR,
                f'div.clicker[data-origin="{YLIST_DOMAIN}"] span.breakage-warning')

        # reveal sliders
        self.driver.find_element(By.ID, 'expand-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # verify there is no breakage warning
        breakage_icon = get_breakage_icon()
        assert not breakage_icon.is_displayed()

        # manually block the yellowlisted domain
        self.js(f'$("#block-{YLIST_DOMAIN.replace(".", "-")}").click()')

        # verify breakage warning is shown
        breakage_icon = get_breakage_icon()
        assert breakage_icon.is_displayed()

        # verify breakage warning is there when reopened
        self.open_popup(FIXTURE_URL)
        breakage_icon = get_breakage_icon()
        assert breakage_icon.is_displayed()

    def test_slider_hiding(self):
        FIXTURE_URL = ("https://privacybadger-tests.eff.org/html/"
            "assorted_thirdparties.html")
        YLIST_DOMAIN = "code.jquery.com"
        BLOCKED_DOMAIN = "efforg.github.io"

        def assert_hidden(sliders):
            for slider in sliders:
                assert not slider.is_displayed(), (
                    "{slider.get_attribute('data-origin')} is visible but should be hidden")

        def assert_visible(sliders):
            for slider in sliders:
                assert slider.is_displayed(), (
                    f"{slider.get_attribute('data-origin')} is hidden but should be visible")

        self.cookieblock_domain(YLIST_DOMAIN)
        self.block_domain(BLOCKED_DOMAIN)

        self.load_url(FIXTURE_URL)
        self.open_popup(FIXTURE_URL)
        sliders = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')

        # verify we have the expected number of sliders
        assert len(sliders) == 2

        # verify sliders are hidden
        assert_hidden(sliders)

        # reveal sliders
        self.driver.find_element(By.ID, 'expand-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # verify sliders are visible
        assert_visible(sliders)

        # reopen popup
        self.open_popup(FIXTURE_URL)
        sliders = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')

        # verify sliders are visible
        assert_visible(sliders)

        # verify domain is shown second in the list
        assert sliders[1].get_attribute('data-origin') == YLIST_DOMAIN

        # manually block the yellowlisted domain
        self.js(f'$("#block-{YLIST_DOMAIN.replace(".", "-")}").click()')

        # hide sliders
        self.driver.find_element(By.ID, 'collapse-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # verify sliders are hidden
        assert_hidden(sliders)

        # reopen popup
        self.open_popup(FIXTURE_URL)
        sliders = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')

        # verify sliders are visible
        assert_visible(sliders)

        # verify breakage warning slider is at the top
        assert sliders[0].get_attribute('data-origin') == YLIST_DOMAIN

        # restore the user-set slider to default action
        with self.wait_for_window_close():
            self.driver.find_element(By.CSS_SELECTOR,
                f'div[data-origin="{YLIST_DOMAIN}"] a.honeybadgerPowered').click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])

        # reopen popup
        self.open_popup(FIXTURE_URL)
        sliders = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')

        # verify sliders are hidden again
        assert_hidden(sliders)

    def test_nothing_blocked_slider_list(self):
        """Verifies display of non-tracking domains."""

        FIXTURE_URL = ("https://privacybadger-tests.eff.org/html/"
            "assorted_thirdparties.html")
        DOMAIN = "efforg.github.io"

        self.load_url(FIXTURE_URL)

        # base case: no sliders should be shown
        self.open_popup(FIXTURE_URL)
        sliders = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')
        assert not sliders

        # enable local learning and showing non-tracking domains
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()
        self.find_el_by_css('#show-nontracking-domains-checkbox').click()

        # non-tracking sliders should now be shown (no collapsing)
        self.open_popup(FIXTURE_URL)
        sliders = self.driver.find_elements(By.CSS_SELECTOR, 'div.clicker')
        assert sliders
        slider = self.driver.find_element(By.CSS_SELECTOR,
            f'div.clicker[data-origin="{DOMAIN}"]')
        assert slider.is_displayed()
        assert self.get_domain_slider_state(DOMAIN) == "allow"

        # now block the domain and verify blocked slider is hidden (list is collapsed)
        self.close_window_with_url(FIXTURE_URL)
        self.block_domain(DOMAIN)
        self.load_url(FIXTURE_URL)
        self.open_popup(FIXTURE_URL)
        slider = self.driver.find_element(By.CSS_SELECTOR,
            f'div.clicker[data-origin="{DOMAIN}"]')
        assert not slider.is_displayed()


if __name__ == "__main__":
    unittest.main()
