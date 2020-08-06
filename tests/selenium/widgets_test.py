#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from time import sleep

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
    TYPE4_WIDGET_CLASS = "pb-type4-test-widget"

    def setUp(self):
        self.set_up_widgets()

    def set_up_widgets(self):
        """Reinitializes Privacy Badger's widget replacement definitions."""

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
                    "type": 3
                }
            },
            self.TYPE4_WIDGET_NAME: {
                "domains": [
                    self.THIRD_PARTY_DOMAIN
                ],
                "buttonSelectors": [
                    "div." + self.TYPE4_WIDGET_CLASS
                ],
                "scriptSelectors": [
                    "script." + self.TYPE4_WIDGET_CLASS
                ],
                "replacementButton": {
                    "unblockDomains": [
                        self.THIRD_PARTY_DOMAIN
                    ],
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

    def assert_widget(self, kind="type3"):
        if kind == "type3":
            self._assert_type3_widget()
        elif kind == "type4":
            self._assert_type4_widget()
        else:
            self.fail("Unknown widget type")

    def _assert_type3_widget(self):
        try:
            self.switch_to_frame('iframe[src]')
        except (StaleElementReferenceException, TimeoutException):
            self.fail("Unable to find widget frame")

        try:
            self.wait_for_text('body', "Hello world!")
        except TimeoutException:
            self.fail("Unable to find expected widget text")

        self.driver.switch_to.default_content()

    def _assert_type4_widget(self):
        try:
            self.wait_for_text('div.' + self.TYPE4_WIDGET_CLASS,
                "A third-party widget script was here")
        except TimeoutException:
            self.fail("Unable to find expected widget output")

    def assert_replacement(self, widget_name=None):
        if not widget_name:
            widget_name = self.TYPE3_WIDGET_NAME

        try:
            self.switch_to_frame('iframe[srcdoc*="{}"]'.format(widget_name))
        except (StaleElementReferenceException, TimeoutException):
            self.fail("Unable to find widget placeholder frame")

        try:
            self.find_el_by_css("button[id^='btn-once-']")
            self.find_el_by_css("button[id^='btn-site-']")
        except TimeoutException:
            self.fail("Unable to find expected widget placeholder buttons")

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
            self.fail("Widget placeholder frame should be missing")
        except TimeoutException:
            pass
        self.driver.switch_to.default_content()

    def activate_widget(self, widget_name=None):
        if not widget_name:
            widget_name = self.TYPE3_WIDGET_NAME
        self.switch_to_frame('iframe[srcdoc*="{}"]'.format(widget_name))
        self.find_el_by_css("button[id^='btn-once-']").click()
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

    # TODO remove retrying after
    # https://github.com/EFForg/privacybadger/pull/2604
    @pbtest.repeat_if_failed(7)
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
            self.driver.find_element_by_css_selector(
                'div.' + self.TYPE4_WIDGET_CLASS)
            self.fail("Widget output container div should be missing")
        except NoSuchElementException:
            pass
        self.assert_replacement(self.TYPE4_WIDGET_NAME)

        self.activate_widget(self.TYPE4_WIDGET_NAME)

        # assert all script attributes were copied
        script_el = self.driver.find_element_by_css_selector(
            'script.' + self.TYPE4_WIDGET_CLASS)
        self.assertEqual(script_el.get_attribute('async'), "true")
        self.assertEqual(script_el.get_attribute('data-foo'), "bar")

        self.assert_widget("type4")

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
        self.assert_widget("type4")

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
        try:
            widget_div = self.driver.find_element_by_css_selector(
                'div.pb-type4-test-widget')
        except NoSuchElementException:
            self.fail("Widget div should still be here")
        # check the div's text a few times to make sure it stays empty
        for _ in range(3):
            self.assertFalse(widget_div.text,
                "Widget output container should remain empty")
            sleep(1)

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
        self.assert_widget("type4")


if __name__ == "__main__":
    unittest.main()
