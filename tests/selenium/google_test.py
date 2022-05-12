#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import time
import unittest

import pbtest

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class GoogleTest(pbtest.PBSeleniumTest):
    """Tests first-party protection for Google."""

    # TODO also test on a different Google CC TLD?
    GOOGLE_SEARCH_DOMAIN = "www.google.com"
    SEARCH_TERM = "Privacy Badger"
    SEARCH_RESULT_URL = "https://privacybadger.org/"

    def perform_google_search(self):
        # perform a search
        self.load_url(f"https://{self.GOOGLE_SEARCH_DOMAIN}/")
        qry_el = self.driver.find_element(By.NAME, "q")
        qry_el.send_keys(self.SEARCH_TERM)
        qry_el.submit()

        # wait for search results
        WebDriverWait(self.driver, 10).until(
            EC.visibility_of_any_elements_located(
                (By.CSS_SELECTOR, f"a[href*='{self.SEARCH_RESULT_URL}']")))

    def test_unwrapping(self):
        self.perform_google_search()

        def _check_results():
            # select all anchor elements with non-empty href attributes
            SELECTOR = "a[href]:not([href=''])"
            search_results = self.driver.find_elements(By.CSS_SELECTOR, SELECTOR)

            # remove "About this result" links as they do not get cleaned
            # (they don't match any of the `trap_link` selectors)
            # and so they fail the rel check below
            search_results = [a for a in search_results if (
                a.text or
                a.get_attribute('textContent') != self.SEARCH_RESULT_URL or
                a.get_attribute('innerHTML') != self.SEARCH_RESULT_URL
            )]

            # verify these appear to be actual search results
            hrefs = [link.get_attribute('href') for link in search_results]
            assert self.SEARCH_RESULT_URL in hrefs, (
                "At least one search result points to our homepage")

            # verify that tracking attributes are missing
            for link in search_results:
                # only check links that point to our homepage
                # as there is a mix of search result links and other links
                # and not all links get cleaned
                # and it's not clear how to select search result links only
                href = link.get_attribute('href')
                if self.SEARCH_RESULT_URL not in href:
                    continue

                assert not link.get_attribute('ping'), (
                    "Tracking attribute should be missing")
                assert not link.get_attribute('onmousedown'), (
                    "Tracking attribute should be missing")
                assert not link.get_attribute('data-jsarwt'), (
                    "Tracking attribute should be missing")

                assert link.get_attribute('rel') == "noreferrer noopener"

            return True

        time.sleep(1)

        results_checker = pbtest.convert_exceptions_to_false(_check_results)
        assert pbtest.retry_until(results_checker, times=6), (
            "Search results still fail our checks after several attempts")

    # TODO fake UA to test Firefox on Android?
    # TODO SELECTOR = "a[href^='/url?q=']"
    def test_no_unwrapping_when_disabled(self):
        """Tests that Google search result links still match our selectors."""

        # use the browser-appropriate selector
        SELECTOR = "a[ping]"
        if pbtest.shim.browser_type != "chrome":
            SELECTOR = "a[onmousedown^='return rwt(this,'], a[data-jsarwt='1']"

        # turn off link unwrapping on Google
        # so that we can test our selectors
        self.disable_badger_on_site(self.GOOGLE_SEARCH_DOMAIN)

        def _perform_search_and_check_results():
            self.perform_google_search()

            search_results = self.driver.find_elements(By.CSS_SELECTOR, SELECTOR)

            # remove "About this result" links as they do not get cleaned
            # (they don't match any of the `trap_link` selectors)
            # and so they fail the rel check below
            search_results = [a for a in search_results if (
                a.text or
                a.get_attribute('textContent') != self.SEARCH_RESULT_URL or
                a.get_attribute('innerHTML') != self.SEARCH_RESULT_URL
            )]

            # check the results
            hrefs = [link.get_attribute('href') for link in search_results]
            assert self.SEARCH_RESULT_URL in hrefs, (
                "At least one search result points to our homepage")

            return True

        results_checker = pbtest.convert_exceptions_to_false(_perform_search_and_check_results)
        assert pbtest.retry_until(results_checker, times=6), (
            "Search results still fail our checks after several attempts")


if __name__ == "__main__":
    unittest.main()
