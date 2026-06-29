#!/usr/bin/env python

import http.server
import threading
import time
import unittest

import pytest

import pbtest


# Simple HTTP server that serves pages with and without a restrictive CSP.
# Privacy Badger reads the Content-Security-Policy response header to decide
# whether to call injectScript(); we need real HTTP headers to test that.

_CSP_PATH = "/csp"
_NO_CSP_PATH = "/no-csp"

_PAGE_BODY = (
    b"<!DOCTYPE html>"
    b"<html><head></head><body></body></html>"
)


class _CspHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        if self.path == _CSP_PATH:
            self.send_header("Content-Security-Policy", "script-src 'self'")
        self.send_header("Content-Length", str(len(_PAGE_BODY)))
        self.end_headers()
        self.wfile.write(_PAGE_BODY)

    def log_message(self, *args):
        pass  # suppress server noise to keep test output clean


# Start the server once for the whole test module.
_server = http.server.HTTPServer(("127.0.0.1", 0), _CspHandler)
_server_port = _server.server_address[1]
threading.Thread(target=_server.serve_forever, daemon=True).start()


class CspInjectScriptTest(pbtest.PBSeleniumTest):
    """Tests that Privacy Badger does not trigger CSP violations.

    Privacy Badger uses injectScript() to inject page scripts for fingerprinting
    detection, supercookie detection, cookie/localStorage clobbering, and DNT.
    On pages with a restrictive Content-Security-Policy, these injections are
    blocked by the browser and generate errors in the browser console.

    Privacy Badger reads the Content-Security-Policy response header in the
    background service worker and gates injectScript()-dependent features on
    whether inline scripts are allowed.  This test verifies that no CSP
    violation errors appear in the browser console when visiting a page with
    a restrictive CSP.

    Without our fix, detectFingerprinting (and the other message handlers)
    would return true even for CSP-restricted pages, causing injectScript()
    to be called and CSP violation errors to appear in the browser log.

    Note: browser log access (self.logs) is Chrome-only.
    """

    def setUp(self):
        # Enable local learning so detectFingerprinting returns true —
        # this ensures injectScript() would be attempted without our fix.
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-general-settings"]').click()
        self.find_el_by_css('#local-learning-checkbox').click()

    def _csp_violations(self):
        return [
            msg for msg in self.logs
            if "content security policy" in msg.lower()
            or "refused to execute inline script" in msg.lower()
        ]

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_no_csp_violations_on_csp_restricted_page(self):
        """Privacy Badger must not trigger CSP violations on CSP-restricted pages."""
        if self.driver.capabilities.get("browserName") == "firefox":
            self.skipTest("browser log API not available in Firefox")

        # Flush any pre-existing log entries.
        _ = self.logs

        self.load_url(f"http://127.0.0.1:{_server_port}{_CSP_PATH}")
        time.sleep(3)

        violations = self._csp_violations()
        assert not violations, (
            "Privacy Badger triggered CSP violations on a page with "
            f"Content-Security-Policy: script-src 'self': {violations}"
        )

    @pytest.mark.flaky(reruns=5, condition=pbtest.shim.browser_type in ("chrome", "edge"))
    def test_no_csp_violations_on_normal_page(self):
        """Baseline: no CSP violations on a page without a CSP."""
        if self.driver.capabilities.get("browserName") == "firefox":
            self.skipTest("browser log API not available in Firefox")

        _ = self.logs

        self.load_url(f"http://127.0.0.1:{_server_port}{_NO_CSP_PATH}")
        time.sleep(3)

        violations = self._csp_violations()
        assert not violations, (
            f"Unexpected CSP violations on a page with no CSP: {violations}"
        )


if __name__ == "__main__":
    unittest.main()
