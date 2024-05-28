#!/usr/bin/env python

import unittest

import pbtest

from selenium.common.exceptions import TimeoutException

from pbtest import retry_until


class SurrogatesTest(pbtest.PBSeleniumTest):
    """Integration tests to verify surrogate script functionality."""

    FIXTURE_URL = (
        "https://efforg.github.io/privacybadger-test-fixtures/html/"
        "ga_surrogate.html"
    )

    def load_ga_js_fixture(self, timeout=12):
        self.load_url(SurrogatesTest.FIXTURE_URL)

        load_status_sel = '#third-party-load-result'
        self.wait_for_script(
            "return document.querySelector(arguments[0]).textContent",
            load_status_sel, timeout=timeout)
        if self.find_el_by_css(load_status_sel).text == "error":
            return False

        try:
            self.wait_for_and_switch_to_frame('iframe', timeout=timeout)
            self.wait_for_text('h1', "It worked!", timeout=timeout)
            return True
        except TimeoutException:
            return False

    def test_ga_js_surrogate(self):
        SURROGATE_HOST = "www.google-analytics.com"

        # clear pre-trained/seed tracker data
        self.clear_tracker_data()

        # verify site loads
        assert self.load_ga_js_fixture(), (
            "page failed to load even before we did anything")

        # block ga.js (should break the site)
        self.block_domain(SURROGATE_HOST)

        # disable surrogates
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'disableSurrogates'"
            "}, done);")
        # disable static rulesets
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.declarativeNetRequest.updateEnabledRulesets({"
            "  disableRulesetIds: ['surrogates_ruleset']"
            "}, done);")
        # back up and disable dynamic rules
        dynamic_surrogate_rules = self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "(async function (domain) {"
            "  let { default: constants } = await import('../js/constants.js');"
            "  let rules = await chrome.declarativeNetRequest.getDynamicRules();"
            "  done(rules.filter(r => r.priority == constants.DNR_SURROGATE_REDIRECT "
            "    && JSON.stringify(r.condition.requestDomains) == JSON.stringify([domain])));"
            "}(arguments[0]));", SURROGATE_HOST)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.declarativeNetRequest.updateDynamicRules({"
            "  removeRuleIds: arguments[0]"
            "}, done);", [r['id'] for r in dynamic_surrogate_rules])

        # verify site breaks
        assert not self.load_ga_js_fixture(), (
            "page loaded successfully when it should have failed")

        # re-enable surrogates
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'restoreSurrogates'"
            "}, done);")
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.declarativeNetRequest.updateEnabledRulesets({"
            "  enableRulesetIds: ['surrogates_ruleset']"
            "}, done);")
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.declarativeNetRequest.updateDynamicRules({"
            "  addRules: arguments[0]"
            "}, done);", dynamic_surrogate_rules)

        # verify site loads again
        assert retry_until(self.load_ga_js_fixture), (
            "page failed to load after surrogation")


if __name__ == "__main__":
    unittest.main()
