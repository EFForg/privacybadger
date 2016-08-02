#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest
from time import sleep
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, TimeoutException


class OptionsPageTest(pbtest.PBSeleniumTest):
    """Make sure the options page works correctly."""

    def hide_tooltip(self, css_selector):
        """Hide the tooltip by moving to a tooltip-less element."""
        # The below element (ui-id-1) is specific to Options page.
        el_no_hover = self.driver.find_element_by_id("ui-id-1")
        ActionChains(self.driver).move_to_element(el_no_hover).perform()
        WebDriverWait(self.driver, 5).until(EC.invisibility_of_element_located(
            (By.CSS_SELECTOR, css_selector)))

    def test_page_title(self):
        self.load_url(pbtest.PB_CHROME_BG_URL)  # load a dummy page
        self.load_url(pbtest.PB_CHROME_OPTIONS_PAGE_URL)
        localized_title = self.js('return i18n.getMessage("options_title")')
        try:
            WebDriverWait(self.driver, 3).until(EC.title_contains(localized_title))
        except:
            self.fail("Unexpected title for the Options page. Got (%s), expected (%s)"
                      % (self.driver.title, localized_title))

    def test_should_display_tooltips_on_hover(self):
        driver = self.driver
        find_el_by_css = self.find_el_by_css  # find with WebDriver wait
        TOOLTIP_TXTS = ("Move the slider left to block a domain.",
                        "Center the slider to block cookies.",
                        "Move the slider right to allow a domain.")
        # We need some tracking domains to be listed in "User Filter Settings"
        # Visit a newspaper page to get some tracker domains
        driver.get("https://nytimes.com/")
        sleep(3)
        MAX_TRY_LOAD_PB_OPTIONS = 5
        tried = 0
        # For an unknown reason, PB Options page cannot be rendered correctly
        # during the first visit or sometimes throw a TimeOutException.
        # Try visiting a couple of times.
        while tried < MAX_TRY_LOAD_PB_OPTIONS:
            tried += 1
            try:
                driver.get(pbtest.PB_CHROME_OPTIONS_PAGE_URL)
                # Click to the second tab (User Filter Settings)
                driver.find_element_by_id("ui-id-1").click()
            except:
                pass
            else:
                break

        tooltip_css = "div.keyContainer > div > div.tooltipContainer"
        for icon_no in range(1, 4):  # repeat for all three icons
            # CSS selector for icons in the keyContainer
            ico_css = "div.keyContainer > div > img:nth-child(%s)" % icon_no
            icon_to_hover = find_el_by_css(ico_css)
            ActionChains(driver).move_to_element(icon_to_hover).perform()
            try:
                tooltip_el = WebDriverWait(driver, 5).until(
                    EC.visibility_of_element_located((By.CSS_SELECTOR,
                                                      tooltip_css)))
            except TimeoutException as e:
                self.fail("Tooltip isn't displayed for keyContainer icon %s %s"
                          % (icon_no, e))
            # compare the tooltip text, should be updated after L10n
            self.assertEqual(TOOLTIP_TXTS[icon_no-1], tooltip_el.text)
            self.hide_tooltip(tooltip_css)

        # Make sure the tooltip is displayed when we hover over an origin
        # Only tests the first origin
        first_origin_css = "div.clickerContainer > div:nth-child(1)"
        origin_el_to_hover = find_el_by_css(first_origin_css + " > div.origin")
        orig_tooltip_css = first_origin_css + " > div.tooltipContainer"
        # move the cursor over the first tracker origin on the list
        ActionChains(driver).move_to_element(origin_el_to_hover).perform()
        try:
            WebDriverWait(driver, 5).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR,
                                                 orig_tooltip_css)))
        except TimeoutException as e:
            self.fail("Tooltip is not displayed for tracker origin. %s" % e)

    def add_test_origin(self, origin, action):
        """Add given origin to backend storage."""
        self.load_url(pbtest.PB_CHROME_OPTIONS_PAGE_URL)
        self.js("pb.storage.setupHeuristicAction('{}', '{}');".format(origin, action))

    def test_added_origin_display(self):
        """Ensure origin and tracker count is displayed."""
        self.add_test_origin("pbtest.org", "block")

        self.load_url(pbtest.PB_CHROME_OPTIONS_PAGE_URL)
        origins = self.driver.find_element_by_id("blockedResourcesInner")

        # Check tracker count.
        error_message = "Origin tracker count should be 1 after adding origin"
        self.assertEqual(
            self.driver.find_element_by_id("count").text, "1", error_message)

        # Check that origin is displayed.
        try:
            origins.find_element_by_xpath(
                './/div[@data-origin="pbtest.org"]' +
                '//div[@class="origin" and text()="pbtest.org"]')
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")

    def test_removed_origin_display(self):
        """Ensure origin is displayed and removed properly."""
        self.add_test_origin("pbtest.org", "block")

        self.load_url(pbtest.PB_CHROME_OPTIONS_PAGE_URL)
        origins = self.driver.find_element_by_id("blockedResourcesInner")

        # Remove displayed origin.
        try:
            remove_origin_element = origins.find_element_by_xpath(
                './/div[@data-origin="pbtest.org"]' +
                '//div[@class="removeOrigin"]')
        except NoSuchElementException:
            self.fail("Tracking origin is not displayed")
        remove_origin_element.click()
        self.driver.switch_to.alert.accept()

        # Check tracker count.
        try:
            WebDriverWait(self.driver, 5).until(
                EC.text_to_be_present_in_element((By.ID, "count"), "0"))
        except TimeoutException:
            self.fail("Origin count should be 0 after deleting origin")

        # Check that no origins are displayed.
        try:
            origins = self.driver.find_element_by_id("blockedResourcesInner")
        except NoSuchElementException:
            origins = None
        error_message = "Origin should not be displayed after removal"
        self.assertIsNone(origins, error_message)


if __name__ == "__main__":
    unittest.main()
