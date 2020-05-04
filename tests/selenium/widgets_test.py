#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from selenium.common.exceptions import (
    StaleElementReferenceException,
    TimeoutException
)
from selenium.webdriver.common.keys import Keys


class WidgetsTest(pbtest.PBSeleniumTest):

    FIXTURES_URL = "https://efforg.github.io/privacybadger-test-fixtures/html/"
    BASIC_FIXTURE_URL = FIXTURES_URL + "widget_basic.html"
    DYNAMIC_FIXTURE_URL = FIXTURES_URL + "widget_dynamic.html"
    THIRD_PARTY_DOMAIN = "privacybadger-tests.eff.org"

    def setup_widget(self):
        """Adds a type 3 test replacement widget to Privacy Badger."""

        widget_name = "Type 3 Widget"

        widgetsJson = {
            widget_name: {
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

        return widget_name

    def switch_to_frame(self, selector):
        self.wait_for_and_switch_to_frame(selector, timeout=3)

    def block_domain(self, domain):
        self.load_url(self.options_url)
        self.js((
            "(function (domain) {"
            "  let bg = chrome.extension.getBackgroundPage();"
            "  let base_domain = window.getBaseDomain(domain);"
            "  bg.badger.heuristicBlocking.blacklistOrigin(domain, base_domain);"
            "}(arguments[0]));"
        ), domain)

    def cookieblock_domain(self, domain):
        self.load_url(self.options_url)
        self.js((
            "(function (domain) {"
            "  let bg = chrome.extension.getBackgroundPage();"
            "  bg.badger.storage.setupHeuristicAction(domain, bg.constants.COOKIEBLOCK);"
            "}(arguments[0]));"
        ), domain)

    def disable_badger_on_site(self, url):
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-whitelisted-domains"]').click()
        self.driver.find_element_by_id('newWhitelistDomain').send_keys(url)
        self.driver.find_element_by_css_selector('button.addButton').click()

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

    def assert_replacement(self, widget_name):
        try:
            self.switch_to_frame('iframe[srcdoc]')
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

    def assert_no_replacement(self):
        try:
            self.switch_to_frame('iframe[srcdoc]')
            self.fail("Replacement widget frame should be missing")
        except TimeoutException:
            pass
        self.driver.switch_to.default_content()

    def test_replacement_basic(self):
        widget_name = self.setup_widget()

        # visit the basic widget fixture
        self.load_url(self.BASIC_FIXTURE_URL)
        # verify the widget is present
        self.assert_widget()

        # block the test widget's domain
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        # revisit the fixture
        self.load_url(self.BASIC_FIXTURE_URL)
        # verify the widget got replaced
        self.assert_replacement(widget_name)

    def test_replacement_dynamic(self):
        widget_name = self.setup_widget()

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
        self.assert_replacement(widget_name)

    def test_activation(self):
        widget_name = self.setup_widget()
        self.block_domain(self.THIRD_PARTY_DOMAIN)
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_replacement(widget_name)

        # click the "allow once" button
        self.switch_to_frame('iframe[srcdoc]')
        self.find_el_by_css('button').click()
        self.driver.switch_to.default_content()

        # verify the original widget is restored
        self.assert_widget()

    def test_disabling_site(self):
        self.setup_widget()
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        self.disable_badger_on_site(self.BASIC_FIXTURE_URL)

        # verify basic widget is neither replaced nor blocked
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_no_replacement()
        self.assert_widget()

        # verify dynamic widget is neither replaced nor blocked
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        self.find_el_by_css('#widget-trigger').click()
        self.assert_no_replacement()
        self.assert_widget()

    def test_disabling_all_replacement(self):
        self.setup_widget()
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

        # verify dynamic widget is no longer replaced
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        self.find_el_by_css('#widget-trigger').click()
        self.assert_no_replacement()
        self.assert_widget_blocked()

    def test_disabling_replacement_for_one_widget(self):
        widget_name = self.setup_widget()
        self.block_domain(self.THIRD_PARTY_DOMAIN)

        # add the widget to the list of exceptions
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-manage-widgets"]').click()
        self.find_el_by_css('input[type="search"]').send_keys(
            widget_name, Keys.ENTER)

        # verify basic widget is no longer replaced
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_no_replacement()
        self.assert_widget_blocked()

        # verify dynamic widget is no longer replaced
        self.load_url(self.DYNAMIC_FIXTURE_URL)
        self.find_el_by_css('#widget-trigger').click()
        self.assert_no_replacement()
        self.assert_widget_blocked()

    def test_no_replacement_when_cookieblocked(self):
        self.setup_widget()
        self.cookieblock_domain(self.THIRD_PARTY_DOMAIN)
        self.load_url(self.BASIC_FIXTURE_URL)
        self.assert_no_replacement()
        self.assert_widget()


if __name__ == "__main__":
    unittest.main()
