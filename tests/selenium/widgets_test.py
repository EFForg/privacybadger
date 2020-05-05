#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException
)
from selenium.webdriver.common.keys import Keys


class WidgetsTest(pbtest.PBSeleniumTest):

    FIXTURES_URL = "https://efforg.github.io/privacybadger-test-fixtures/html/"
    BASIC_FIXTURE_URL = FIXTURES_URL + "widget_basic.html"
    DYNAMIC_FIXTURE_URL = FIXTURES_URL + "widget_dynamic.html"
    THIRD_PARTY_DOMAIN = "privacybadger-tests.eff.org"
    TYPE3_WIDGET_NAME = "Type 3 Widget"
    TYPE4_WIDGET_NAME = "Type 4 Widget"

    def setUp(self):
        self.set_up_widgets()

    def set_up_widgets(self):
        """Reinitializes Privacy Badger's replacement widget definitions."""

        widgetsJson = {
            self.TYPE3_WIDGET_NAME: {
                "domain": self.THIRD_PARTY_DOMAIN,
                "buttonSelectors": [
                    "iframe#pb-type3-test-widget"
                ],
                "replacementButton": {
                    "unblockDomains": [
                        self.THIRD_PARTY_DOMAIN
                    ],
                    "imagePath": "badger-play.png",
                    "type": 3
                }
            },
            self.TYPE4_WIDGET_NAME: {
                "domains": [
                    self.THIRD_PARTY_DOMAIN
                ],
                "buttonSelectors": [
                    "div.pb-type4-test-widget"
                ],
                "scriptSelectors": [
                    "script.pb-type4-test-widget"
                ],
                "replacementButton": {
                    "unblockDomains": [
                        self.THIRD_PARTY_DOMAIN
                    ],
                    "imagePath": "badger-play.png",
                    "type": 4
                }
            }
        }

        # reinitialize widgets using above JSON
        self.load_url(self.options_url)
        self.js((
            "(function (widgetsJson) {"
            "  let bg = chrome.extension.getBackgroundPage();"
            "  bg.badger.widgetList = bg.widgetLoader.initializeWidgets(widgetsJson);"
            "}(arguments[0]));"
        ), widgetsJson)

    def switch_to_frame(self, selector):
        self.wait_for_and_switch_to_frame(selector, timeout=3)

    def assert_widget(self):
        try:
            self.switch_to_frame('iframe[src]')
        except (StaleElementReferenceException, TimeoutException):
            self.fail("Unable to find widget frame")

        try:
            self.wait_for_text('body', "Hello world!")
        except TimeoutException:
            self.fail("Unable to find expected widget text")

        self.driver.switch_to.default_content()

    def get_type4_widget_div(self):
        return self.driver.find_element_by_css_selector(
            'div.pb-type4-test-widget')

    def get_type4_widget_script(self):
        return self.driver.find_element_by_css_selector(
            'script.pb-type4-test-widget')

    def assert_type4_widget(self):
        self.assertEqual(
            self.get_type4_widget_div().text,
            "A third-party widget script was here",
            "Widget output should be present")

    def assert_replacement(self, widget_name=None):
        if not widget_name:
            widget_name = self.TYPE3_WIDGET_NAME

        try:
            self.switch_to_frame('iframe[srcdoc*="{}"]'.format(widget_name))
        except (StaleElementReferenceException, TimeoutException):
            self.fail("Unable to find replacement frame")

        try:
            self.wait_for_text('body', (
                "Privacy Badger has replaced this {} button"
            ).format(widget_name))
        except TimeoutException:
            self.fail("Unable to find expected replacement widget text")

        self.driver.switch_to.default_content()

    def assert_widget_blocked(self):
        try:
            self.switch_to_frame('iframe[src]')
        except TimeoutException:
            self.fail("Widget frame should still be here")

        self.assertFalse(
            self.txt_by_css('body'), "Widget frame should be empty")

        self.driver.switch_to.default_content()

    def assert_no_widget(self):
        try:
            self.switch_to_frame('iframe[src]')
            self.fail("Widget frame should be missing")
        except TimeoutException:
            pass
        self.driver.switch_to.default_content()

    def assert_no_replacement(self, widget_name=None):
        if not widget_name:
            widget_name = self.TYPE3_WIDGET_NAME
        try:
            self.switch_to_frame('iframe[srcdoc*="{}"]'.format(widget_name))
            self.fail("Replacement widget frame should be missing")
        except TimeoutException:
            pass
        self.driver.switch_to.default_content()

    def activate_widget(self, widget_name=None):
        if not widget_name:
            widget_name = self.TYPE3_WIDGET_NAME
        self.switch_to_frame('iframe[srcdoc*="{}"]'.format(widget_name))
        self.find_el_by_css('button').click()
        self.driver.switch_to.default_content()

    def test_replacement_basic(self):
        # visit the basic widget fixture
        self.load_url(self.BASIC_FIXTURE_URL)
        # verify the widget is present
        self.assert_widget()

        # block the test widget's domain
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        # revisit the fixture
        self.load_url(self.BASIC_FIXTURE_URL)
        # verify the widget got replaced
        self.assert_replacement()

    def test_replacement_dynamic(self):
        # visit the dynamic widget fixture
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        # verify the widget is initially missing
        self.assert_no_widget()

        # verify the widget shows up once you click on the trigger element
        self.find_el_by_css('#widget-trigger').click()
        self.assert_widget()

        # block the test widget's domain
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        # revisit the fixture
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        # click on the trigger element
        self.find_el_by_css('#widget-trigger').click()
        # verify the widget got replaced
        self.assert_replacement()

    def test_activation(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_replacement()

        # click the "allow once" button
        self.activate_widget()

        # verify the original widget is restored
        self.assert_widget()

        # verify the type 4 widget is still replaced
        try:
            self.get_type4_widget_div()
            self.fail("Widget output container div should be missing")
        except NoSuchElementException:
            pass
        self.assert_replacement(self.TYPE4_WIDGET_NAME)

        self.activate_widget(self.TYPE4_WIDGET_NAME)

        # assert all script attributes were copied
        script_el = self.get_type4_widget_script()
        self.assertEqual(script_el.get_attribute('async'), "true")
        self.assertEqual(script_el.get_attribute('data-foo'), "bar")

        self.assert_type4_widget()

    def test_disabling_site(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        self.disable_badger_on_site(self.BASIC_FIXTURE_URL)

        # verify basic widget is neither replaced nor blocked
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_no_replacement()
        self.assert_widget()
        # type 4 replacement should also be missing
        self.assert_no_replacement(self.TYPE4_WIDGET_NAME)
        # while the type 4 widget script should have executed
        self.assert_type4_widget()

        # verify dynamic widget is neither replaced nor blocked
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        self.find_el_by_css('#widget-trigger').click()
        self.assert_no_replacement()
        self.assert_widget()

    def test_disabling_all_replacement(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        # disable widget replacement
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-manage-widgets"]').click()
        self.driver.find_element_by_id('replace-widgets-checkbox').click()

        # verify basic widget is no longer replaced
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_no_replacement()
        self.assert_widget_blocked()
        # type 4 replacement should also be missing
        self.assert_no_replacement(self.TYPE4_WIDGET_NAME)
        # type 4 widget should also have gotten blocked
        self.assertFalse(self.get_type4_widget_div().text,
            "Widget output container div should be present but empty")

        # verify dynamic widget is no longer replaced
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        self.find_el_by_css('#widget-trigger').click()
        self.assert_no_replacement()
        self.assert_widget_blocked()

    def test_disabling_replacement_for_one_widget(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        # add the widget to the list of exceptions
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-manage-widgets"]').click()
        self.find_el_by_css('input[type="search"]').send_keys(
            self.TYPE3_WIDGET_NAME, Keys.ENTER)

        # verify basic widget is no longer replaced
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_no_replacement()
        self.assert_widget_blocked()
        # verify the type 4 widget is still replaced
        self.assert_replacement(self.TYPE4_WIDGET_NAME)

        # verify dynamic widget is no longer replaced
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        self.find_el_by_css('#widget-trigger').click()
        self.assert_no_replacement()
        self.assert_widget_blocked()

    def test_no_replacement_when_cookieblocked(self):
        self.cookieblock_domain(self.THIRD_PARTY_DOMAIN)
        self.load_url(self.BASIC_FIXTURE_URL)

        self.assert_no_replacement()
        self.assert_no_replacement(self.TYPE4_WIDGET_NAME)

        self.assert_widget()
        self.assert_type4_widget()


if __name__ == "__main__":
    unittest.main()
