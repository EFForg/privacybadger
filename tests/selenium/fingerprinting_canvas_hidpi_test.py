#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest

import pbtest

from pbtest import retry_until


class FingerprintingTest(pbtest.PBSeleniumTest):
    """Tests to make sure we don't restore a native canvas function that has been overridden."""

    # Returns true if function is native
    def detected_native_function(self):
        return self.js("""
            const canvas = document.getElementById("writetome");
            const ctx = canvas.getContext("2d");
            return ctx.fillText.toString().indexOf("[native code]") !== -1;
        """)

    # TODO can fail because our content script runs too late: https://crbug.com/478183
    @pbtest.repeat_if_failed(3)
    def test_canvas_fingerprinting_detection(self):
        FIXTURE_URL = (
            "https://efforg.github.io/privacybadger-test-fixtures/html/"
            "fingerprinting_canvas_hidpi.html"
        )

        # visit the page
        self.load_url(FIXTURE_URL)

        # check that we did not restore the native function (should be hipdi polyfill)
        self.assertFalse(
            self.detected_native_function(),
            "Canvas context fillText is not native version (polyfill has been retained)."
        )


if __name__ == "__main__":
    unittest.main()
