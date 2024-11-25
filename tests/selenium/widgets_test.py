#!/usr/bin/env python

import unittest

import pbtest

from time import sleep

from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException
)
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select


class WidgetsTest(pbtest.PBSeleniumTest):

    FIXTURES_URL = "https://efforg.github.io/privacybadger-test-fixtures/html/"
    FIXTURES_HOST = "efforg.github.io"
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
        self.driver.execute_async_script((
            "let done = arguments[arguments.length - 1];"
            "(async function (widgetsJson) {"
            "  const { default: widgetLoader } = await import('../js/socialwidgetloader.js');"
            "  chrome.runtime.sendMessage({"
            "    type: 'setWidgetList',"
            "    value: widgetLoader.initializeWidgets(widgetsJson)"
            "  }, done);"
            "}(arguments[0]));"
        ), widgetsJson)

    def switch_to_frame(self, selector):
        self.wait_for_and_switch_to_frame(selector, timeout=1)

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
            self.switch_to_frame(f'iframe[srcdoc*="{widget_name}"]')
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

        frame_text = self.txt_by_css('body')
        # TODO doesn't work in non-English locales
        if frame_text != "This page has been blocked by an extension":
            assert not frame_text, "Widget frame should be empty"

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
            self.switch_to_frame(f'iframe[srcdoc*="{widget_name}"]')
            self.fail("Widget placeholder frame should be missing")
        except TimeoutException:
            pass
        self.driver.switch_to.default_content()

    def activate_widget(self, widget_name=None, once=True):
        if not widget_name:
            widget_name = self.TYPE3_WIDGET_NAME
        id_prefix = 'btn-once' if once else 'btn-site'
        self.switch_to_frame(f'iframe[srcdoc*="{widget_name}"]')
        self.find_el_by_css(f"button[id^='{id_prefix}']").click()
        self.driver.switch_to.default_content()
        # wait a bit for the widget to get reinserted
        sleep(1)

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
            self.driver.find_element(By.CSS_SELECTOR,
                'div.' + self.TYPE4_WIDGET_CLASS)
            self.fail("Widget output container div should be missing")
        except NoSuchElementException:
            pass
        self.assert_replacement(self.TYPE4_WIDGET_NAME)

        self.activate_widget(self.TYPE4_WIDGET_NAME)

        # assert all script attributes were copied
        script_el = self.driver.find_element(By.CSS_SELECTOR,
            'script.' + self.TYPE4_WIDGET_CLASS)
        assert script_el.get_dom_attribute('async') == "true"
        assert script_el.get_dom_attribute('data-foo') == "bar"

        self.assert_widget("type4")

    def test_activation_site(self):
        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_replacement()

        # click the "allow once" button
        self.activate_widget()

        # verify the original widget is restored
        self.assert_widget()

        # open a new window (to get around widget activation caching)
        self.open_window()
        self.load_url(self.BASIC_FIXTURE_URL)

        # verify the widget got replaced
        self.assert_replacement()

        # click the "allow on site" button
        self.activate_widget(once=False)

        # verify the original widget is restored
        self.assert_widget()

        # open a new window (to get around widget activation caching)
        self.open_window()
        self.load_url(self.BASIC_FIXTURE_URL)

        # verify basic widget is neither replaced nor blocked
        self.assert_no_replacement()
        self.assert_widget()

        # remove the site exception
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-manage-widgets"]').click()
        select = Select(self.driver.find_element(By.ID, 'widget-site-exceptions-select'))
        select.select_by_value(self.FIXTURES_HOST)
        self.driver.find_element(By.ID, 'widget-site-exceptions-remove-button').click()

        # verify basic widget is replaced again
        self.open_window()
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_replacement()

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
