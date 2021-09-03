#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest

import pbtest

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait


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

    def open_popup(self, show_nag=False, origins=None):
        """Open popup and optionally close overlay."""

        self.open_window()
        self.load_url(self.popup_url)
        self.wait_for_script("return window.POPUP_INITIALIZED")

        # populate tabData for the popup's tab
        # to get a regular page popup
        # instead of a special browser page popup
        #
        # optionally set the domains the popup should report
        #
        # optionally show the new user welcome page reminder
        popup_js = (
            "(function (origins, show_nag) {"
            ""
            "let bg = chrome.extension.getBackgroundPage();"
            ""
            "chrome.tabs.getCurrent(tab => {"
            "  bg.badger.recordFrame(tab.id, 0, tab.url);"
            ""
            "  for (let domain of Object.keys(origins)) {"
            "    bg.badger.logThirdPartyOriginOnTab(tab.id, domain, origins[domain]);"
            "  }"
            ""
            "  chrome.runtime.sendMessage({"
            "    type: 'getPopupData',"
            "    tabId: tab.id"
            "  }, (response) => {"
            "    response.settings.seenComic = !show_nag;"
            "    setPopupData(response);"
            "    refreshPopup();"
            "    showNagMaybe();"
            "    window.DONE_REFRESHING = true;"
            "  });"
            "});"
            ""
            "}(arguments[0], arguments[1]));"
        )
        self.js(popup_js, origins if origins else {}, show_nag)

        # wait until the async functions above are done
        self.wait_for_script(
            "return typeof window.DONE_REFRESHING != 'undefined'",
            timeout=5,
            message="Timed out waiting for popup to finish initializing"
        )

        # wait for any sliders to finish rendering
        self.wait_for_script("return window.SLIDERS_DONE")

    def get_enable_button(self):
        """Get enable button on popup."""
        return self.driver.find_element_by_id("activate_site_btn")

    def get_disable_button(self):
        """Get disable button on popup."""
        return self.driver.find_element_by_id("deactivate_site_btn")

    def test_welcome_page_reminder_overlay(self):
        """Ensure overlay links to new user welcome page."""

        # first close the welcome page if already open
        try:
            self.close_window_with_url(self.first_run_url, max_tries=1)
        except pbtest.WindowNotFoundException:
            pass

        self.open_popup(show_nag=True)
        self.driver.find_element_by_id("intro-reminder-btn").click()

        # Look for first run page and return if found.
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
        self.driver.find_element_by_id("help").click()

        self.switch_to_window_with_url(FAQ_URL)

    def test_options_button(self):
        """Ensure options page is opened when button is clicked."""
        self.open_popup()
        self.driver.find_element_by_id("options").click()
        self.switch_to_window_with_url(self.options_url)

    @pbtest.repeat_if_failed(5)
    def test_trackers_link(self):
        """Ensure trackers link opens EFF website."""

        EFF_URL = "https://privacybadger.org/#What-is-a-third-party-tracker"

        self.open_popup()

        # Get all possible tracker links ("no" and "multiple" messages)
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
        self.switch_to_window_with_url(EFF_URL)

        self.wait_for_page_to_start_loading(EFF_URL)

        self.assertEqual(EFF_URL, self.driver.current_url,
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

        # enable learning to show not-yet-blocked domains in popup
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()

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
        new_action = self.get_domain_slider_state(DOMAIN)

        self.assertEqual("block", new_action,
            "The domain should be blocked on options page.")

        # test toggling some more
        self.open_popup(origins={DOMAIN:"user_block"})

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
        new_action = self.get_domain_slider_state(DOMAIN)

        self.assertEqual("block", new_action,
            "The domain should still be blocked on options page.")

    def test_reverting_control(self):
        """Test restoring control of a domain to Privacy Badger."""
        self.clear_seed_data()

        DOMAIN = "example.com"
        DOMAIN_ID = DOMAIN.replace(".", "-")

        # record the domain as cookieblocked by Badger
        self.cookieblock_domain(DOMAIN)

        self.open_popup(origins={DOMAIN:"cookieblock"})

        # reveal sliders
        self.driver.find_element_by_id('expand-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # set the domain to user control
        # click input with JavaScript to avoid "Element ... is not clickable" /
        # "Other element would receive the click" Selenium limitation
        self.js("$('#block-{}').click()".format(DOMAIN_ID))

        # restore control to Badger
        self.driver.find_element_by_css_selector(
            'div[data-origin="{}"] a.honeybadgerPowered'.format(DOMAIN)
        ).click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])

        # verify the domain is no longer user controlled
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-tracking-domains"]').click()

        # assert the action is not what we manually clicked
        action = self.get_domain_slider_state(DOMAIN)
        self.assertEqual("cookieblock", action,
            "Domain's action should have been restored.")

        # assert the undo arrow is not displayed
        self.driver.find_element_by_css_selector('a[href="#tab-tracking-domains"]').click()
        self.assertFalse(
            self.driver.find_element_by_css_selector(
                'div[data-origin="{}"] a.honeybadgerPowered'.format(DOMAIN)
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
        self.open_popup()

        # Check that popup state changed after disabling.
        disable_button = self.get_disable_button()
        self.assertFalse(disable_button.is_displayed(),
                         "Disable button" + DISPLAYED_ERROR)
        enable_button = self.get_enable_button()
        self.assertTrue(enable_button.is_displayed(),
                        "Enable button" + NOT_DISPLAYED_ERROR)

        enable_button.click()

        self.driver.switch_to.window(self.driver.window_handles[0])
        self.open_popup()

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
        self.switch_to_window_with_url(EFF_URL)

        self.wait_for_page_to_start_loading(EFF_URL)

        self.assertEqual(EFF_URL, self.driver.current_url,
            "EFF website should open after clicking donate button on popup")

    def test_breakage_warnings(self):
        YLIST_DOMAIN = "jquery.com"
        self.open_popup(origins={YLIST_DOMAIN: "cookieblock"})

        def get_breakage_icon():
            return self.driver.find_element_by_css_selector(
                'div.clicker[data-origin="{}"] span.breakage-warning'.format(YLIST_DOMAIN))

        # reveal sliders
        self.driver.find_element_by_id('expand-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # verify there is no breakage warning
        breakage_icon = get_breakage_icon()
        self.assertFalse(breakage_icon.is_displayed())

        # manually block the yellowlisted domain
        self.js("$('#block-{}').click()".format(YLIST_DOMAIN.replace(".", "-")))

        # verify breakage warning is shown
        breakage_icon = get_breakage_icon()
        self.assertTrue(breakage_icon.is_displayed())

        # verify breakage warning is there when reopened
        self.open_popup(origins={YLIST_DOMAIN: "user_block"}) # TODO hack
        breakage_icon = get_breakage_icon()
        self.assertTrue(breakage_icon.is_displayed())

    def test_slider_hiding(self):
        YLIST_DOMAIN = "jquery.com"
        TEST_DOMAINS = {
            "example.com": "block",
            YLIST_DOMAIN: "cookieblock"
        }

        def assert_hidden(sliders):
            for slider in sliders:
                self.assertFalse(slider.is_displayed(),
                    "{} is visible but should be hidden".format(
                        slider.get_attribute('data-origin')))

        def assert_visible(sliders):
            for slider in sliders:
                self.assertTrue(slider.is_displayed(),
                    "{} is hidden but should be visible".format(
                        slider.get_attribute('data-origin')))

        self.open_popup(origins=TEST_DOMAINS)
        sliders = self.driver.find_elements_by_css_selector('div.clicker')

        # verify we have the expected number of sliders
        self.assertEqual(len(TEST_DOMAINS), len(sliders))

        # verify sliders are hidden
        assert_hidden(sliders)

        # reveal sliders
        self.driver.find_element_by_id('expand-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # verify sliders are visible
        assert_visible(sliders)

        # reopen popup
        self.open_popup(origins=TEST_DOMAINS)
        sliders = self.driver.find_elements_by_css_selector('div.clicker')

        # verify sliders are visible
        assert_visible(sliders)

        # verify domain is shown second in the list
        self.assertEqual(YLIST_DOMAIN, sliders[1].get_attribute('data-origin'))

        # manually block the yellowlisted domain
        self.js("$('#block-{}').click()".format(YLIST_DOMAIN.replace(".", "-")))

        # hide sliders
        self.driver.find_element_by_id('collapse-blocked-resources').click()
        # TODO retry instead
        time.sleep(1)

        # verify sliders are hidden
        assert_hidden(sliders)

        # reopen popup
        TEST_DOMAINS[YLIST_DOMAIN] = "user_block" # TODO hack
        self.open_popup(origins=TEST_DOMAINS)
        sliders = self.driver.find_elements_by_css_selector('div.clicker')

        # verify sliders are visible
        assert_visible(sliders)

        # verify breakage warning slider is at the top
        self.assertEqual(YLIST_DOMAIN, sliders[0].get_attribute('data-origin'))

        # restore the user-set slider to default action
        self.driver.find_element_by_css_selector(
            'div[data-origin="{}"] a.honeybadgerPowered'.format(YLIST_DOMAIN)
        ).click()

        # get back to a valid window handle as the window just got closed
        self.driver.switch_to.window(self.driver.window_handles[0])

        # reopen popup
        TEST_DOMAINS[YLIST_DOMAIN] = "cookieblock" # TODO hack
        self.open_popup(origins=TEST_DOMAINS)
        sliders = self.driver.find_elements_by_css_selector('div.clicker')

        # verify sliders are hidden again
        assert_hidden(sliders)

    def test_nothing_blocked_slider_list(self):
        # enable local learning and showing non-tracking domains
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('#local-learning-checkbox').click()
        self.find_el_by_css('#show-nontracking-domains-checkbox').click()

        # base case: verify blocked slider is hidden (list is collapsed)
        self.open_popup(origins={'example.com': 'block'})
        slider = self.driver.find_element_by_css_selector('div.clicker[data-origin="example.com"]')
        self.assertFalse(slider.is_displayed())

        # reopen popup
        self.open_popup(origins={'example.com': 'noaction'})
        # verify a non-tracking slider gets shown (no collapsing, just show the list)
        slider = self.driver.find_element_by_css_selector('div.clicker[data-origin="example.com"]')
        self.assertTrue(slider.is_displayed())


if __name__ == "__main__":
    unittest.main()
