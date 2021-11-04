# -*- coding: UTF-8 -*-

import functools
import json
import os
import re
import subprocess
import tempfile
import time
import unittest

from contextlib import contextmanager
from shutil import copytree

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchWindowException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

try:
    from xvfbwrapper import Xvfb
except ImportError:
    print("\n\nxvfbwrapper Python package import failed")
    print("headless mode (ENABLE_XVFB=1) is not supported")


SEL_DEFAULT_WAIT_TIMEOUT = 30

BROWSER_TYPES = ['chrome', 'firefox']
BROWSER_NAMES = ['google-chrome', 'google-chrome-stable', 'google-chrome-beta', 'firefox']

parse_stdout = lambda res: res.strip().decode('utf-8')

run_shell_command = lambda command: parse_stdout(subprocess.check_output(command))

GIT_ROOT = run_shell_command(['git', 'rev-parse', '--show-toplevel'])


class WindowNotFoundException(Exception):
    pass


def unix_which(command, silent=False):
    try:
        return run_shell_command(['which', command])
    except subprocess.CalledProcessError as e:
        if silent:
            return None
        raise e


def get_browser_type(string):
    for t in BROWSER_TYPES:
        if t in string.lower():
            return t
    raise ValueError("couldn't get browser type from %s" % string)


def get_browser_name(string):
    if ('/' in string) or ('\\' in string): # it's a path
        return os.path.basename(string)

    # it's a browser type
    for bn in BROWSER_NAMES:
        if string in bn and unix_which(bn, silent=True):
            return os.path.basename(unix_which(bn))
    raise ValueError('Could not get browser name from %s' % string)


class Shim:
    _browser_msg = '''BROWSER should be one of:
* /path/to/a/browser
* a browser executable name so we can find the browser with "which $BROWSER"
* something from BROWSER_TYPES
'''
    __doc__ = 'Chooses the correct driver and extension_url based on the BROWSER environment\nvariable. ' + _browser_msg

    def __init__(self):
        print("\n\nConfiguring the test run ...")

        browser = os.environ.get('BROWSER')

        # get browser_path and browser_type first
        if browser is None:
            raise ValueError("The BROWSER environment variable is not set. " + self._browser_msg)

        if ("/" in browser) or ("\\" in browser): # path to a browser binary
            self.browser_path = browser
            self.browser_type = get_browser_type(self.browser_path)
        elif unix_which(browser, silent=True): # executable browser name like 'google-chrome-stable'
            self.browser_path = unix_which(browser)
            self.browser_type = get_browser_type(browser)
        elif get_browser_type(browser): # browser type like 'firefox' or 'chrome'
            bname = get_browser_name(browser)
            self.browser_path = unix_which(bname)
            self.browser_type = browser
        else:
            raise ValueError("could not infer BROWSER from %s" % browser)

        self.extension_path = os.path.join(GIT_ROOT, 'src')

        if self.browser_type == 'chrome':
            # this extension ID and the "key" property in manifest.json
            # must both be derived from the same private key
            self.info = {
                'extension_id': 'mcgekeccgjgcmhnhbabplanchdogjcnh'
            }
            self.manager = self.chrome_manager
            self.base_url = 'chrome-extension://%s/' % self.info['extension_id']

            # make extension ID constant across runs
            self.fix_chrome_extension_id()

        elif self.browser_type == 'firefox':
            self.info = {
                'extension_id': 'jid1-MnnxcxisBPnSXQ@jetpack',
                'uuid': 'd56a5b99-51b6-4e83-ab23-796216679614'
            }
            self.manager = self.firefox_manager
            self.base_url = 'moz-extension://%s/' % self.info['uuid']

        print('\nUsing browser path: %s\nwith browser type: %s\nand extension path: %s\n' % (
            self.browser_path, self.browser_type, self.extension_path))

    def fix_chrome_extension_id(self):
        # create temp directory
        self.tmp_dir = tempfile.TemporaryDirectory()
        new_extension_path = os.path.join(self.tmp_dir.name, "src")

        # copy extension sources there
        copytree(self.extension_path, new_extension_path)

        # update manifest.json
        manifest_path = os.path.join(new_extension_path, "manifest.json")
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        # this key and the extension ID must both be derived from the same private key
        manifest['key'] = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArMdgFkGsm7nOBr/9qkx8XEcmYSu1VkIXXK94oXLz1VKGB0o2MN+mXL/Dsllgkh61LZgK/gVuFFk89e/d6Vlsp9IpKLANuHgyS98FKx1+3sUoMujue+hyxulEGxXXJKXhk0kGxWdE0IDOamFYpF7Yk0K8Myd/JW1U2XOoOqJRZ7HR6is1W6iO/4IIL2/j3MUioVqu5ClT78+fE/Fn9b/DfzdX7RxMNza9UTiY+JCtkRTmm4ci4wtU1lxHuVmWiaS45xLbHphQr3fpemDlyTmaVoE59qG5SZZzvl6rwDah06dH01YGSzUF1ezM2IvY9ee1nMSHEadQRQ2sNduNZWC9gwIDAQAB" # noqa:E501 pylint:disable=line-too-long
        with open(manifest_path, "w") as f:
            json.dump(manifest, f)

        # update self.extension_path
        self.extension_path = new_extension_path

    @property
    def wants_xvfb(self):
        if self.on_travis or bool(int(os.environ.get('ENABLE_XVFB', 0))):
            try:
                Xvfb
            except NameError:
                print("\nHeadless mode not supported: install xvfbwrapper first")
                return False
            return True
        return False

    @property
    def on_travis(self):
        if "TRAVIS" in os.environ:
            return True
        return False

    @contextmanager
    def chrome_manager(self):
        opts = ChromeOptions()
        if self.on_travis: # github.com/travis-ci/travis-ci/issues/938
            opts.add_argument("--no-sandbox")
        opts.add_argument("--load-extension=" + self.extension_path)
        opts.binary_location = self.browser_path
        opts.add_experimental_option("prefs", {"profile.block_third_party_cookies": False})

        # TODO not yet in Firefox (w/o hacks anyway):
        # https://github.com/mozilla/geckodriver/issues/284#issuecomment-456073771
        opts.set_capability("loggingPrefs", {'browser': 'ALL'})

        for i in range(5):
            try:
                driver = webdriver.Chrome(options=opts)
            except WebDriverException as e:
                if i == 0: print("")
                print("Chrome WebDriver initialization failed:")
                print(str(e) + "Retrying ...")
            else:
                break

        try:
            yield driver
        finally:
            driver.quit()

    @contextmanager
    def firefox_manager(self):
        ffp = webdriver.FirefoxProfile()
        # make extension ID constant across runs
        ffp.set_preference('extensions.webextensions.uuids', '{"%s": "%s"}' %
                           (self.info['extension_id'], self.info['uuid']))

        # needed for test_referrer_header()
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1720294
        ffp.set_preference('network.http.referer.disallowCrossSiteRelaxingDefault', False)

        for i in range(5):
            try:
                opts = FirefoxOptions()
                # to produce a trace-level geckodriver.log,
                # remove the service_log_path argument to Firefox()
                # and uncomment the line below
                #opts.log.level = "trace"
                driver = webdriver.Firefox(
                    firefox_profile=ffp,
                    firefox_binary=self.browser_path,
                    options=opts,
                    service_log_path=os.path.devnull)
            except WebDriverException as e:
                if i == 0: print("")
                print("Firefox WebDriver initialization failed:")
                print(str(e) + "Retrying ...")
            else:
                break

        driver.install_addon(self.extension_path, temporary=True)

        try:
            yield driver
        finally:
            driver.quit()


shim = Shim() # create the browser shim


def retry_until(fun, tester=None, times=3, msg=None):
    """
    Execute function `fun` until either its return is truthy
    (or if `tester` is set, until the result of calling `tester` with `fun`'s return is truthy),
    or it gets executed X times, where X = `times` + 1.
    """
    for i in range(times):
        result = fun()

        if tester is not None:
            if tester(result):
                break
        elif result:
            break

        if msg:
            if i == 0:
                print("")
            print(msg)

        time.sleep(2 ** i)

    return result


def convert_exceptions_to_false(fun, silent=False):
    def converter(fun, silent):
        try:
            result = fun()
        except Exception as e:
            if not silent:
                print("\nCaught exception:", str(e))
            return False
        return result
    return functools.partial(converter, fun, silent)


class PBSeleniumTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manager = shim.manager
        cls.base_url = shim.base_url
        cls.wants_xvfb = shim.wants_xvfb
        if cls.wants_xvfb:
            cls.vdisplay = Xvfb(width=1280, height=720)
            cls.vdisplay.start()

        # setting DBUS_SESSION_BUS_ADDRESS to nonsense prevents frequent
        # hangs of chromedriver (possibly due to crbug.com/309093)
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"
        cls.proj_root = GIT_ROOT

    @classmethod
    def tearDownClass(cls):
        if cls.wants_xvfb:
            cls.vdisplay.stop()

    def init(self, driver):
        self.driver = driver
        self.js = self.driver.execute_script
        self.bg_url = self.base_url + "_generated_background_page.html"
        self.options_url = self.base_url + "skin/options.html"
        self.popup_url = self.base_url + "skin/popup.html"
        self.first_run_url = self.base_url + "skin/firstRun.html"
        self.test_url = self.base_url + "tests/index.html"

    def run(self, result=None):
        with self.manager() as driver:
            self.init(driver)

            # wait for Badger's storage, listeners, ...
            self.load_url(self.options_url)
            self.wait_for_script(
                "return chrome.extension.getBackgroundPage()."
                "badger.INITIALIZED"
            )

            driver.close()
            if driver.window_handles:
                driver.switch_to.window(driver.window_handles[0])

            super(PBSeleniumTest, self).run(result)

    def is_firefox_nightly(self):
        caps = self.driver.capabilities
        if caps['browserName'] == "firefox":
            version = self.driver.capabilities['browserVersion']
            return re.search('a[0-9]+$', version) is not None
        return False

    def open_window(self):
        if self.driver.current_url.startswith("moz-extension://"):
            # work around https://bugzilla.mozilla.org/show_bug.cgi?id=1491443
            self.wait_for_script("return typeof chrome != 'undefined' && chrome && chrome.extension")
            self.js(
                "delete window.__new_window_created;"
                "chrome.windows.create({}, function () {"
                "window.__new_window_created = true;"
                "});"
            )
            self.wait_for_script("return window.__new_window_created")
        else:
            self.js('window.open()')

        self.driver.switch_to.window(self.driver.window_handles[-1])

    def load_url(self, url, wait_for_body_text=False, retries=5):
        """Load a URL and wait before returning."""
        for i in range(retries):
            try:
                self.driver.get(url)
                break
            except TimeoutException as e:
                if i < retries - 1:
                    time.sleep(2 ** i)
                    continue
                raise e
            # work around geckodriver/marionette/Firefox timeout handling,
            # for example: https://travis-ci.org/EFForg/privacybadger/jobs/389429089
            except WebDriverException as e:
                if str(e).startswith("Reached error page") and i < retries - 1:
                    time.sleep(2 ** i)
                    continue
                raise e

        if wait_for_body_text:
            # wait for document.body.textContent to become truthy
            retry_until(
                lambda: self.driver.find_element_by_tag_name('body').text)

    def txt_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        """Find an element by CSS selector and return its text."""
        return self.find_el_by_css(
            css_selector, visible_only=False, timeout=timeout).text

    def find_el_by_css(self, css_selector, visible_only=True, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        condition = (
            EC.visibility_of_element_located if visible_only
            else EC.presence_of_element_located
        )
        return WebDriverWait(self.driver, timeout).until(
            condition((By.CSS_SELECTOR, css_selector)))

    def find_el_by_xpath(self, xpath, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located((By.XPATH, xpath)))

    def wait_for_script(
        self,
        script,
        *script_args,
        timeout=SEL_DEFAULT_WAIT_TIMEOUT,
        message="Timed out waiting for execute_script to eval to True"
    ):
        """Variant of self.js that executes script continuously until it
        returns True."""
        return WebDriverWait(self.driver, timeout).until(
            lambda driver: driver.execute_script(script, *script_args),
            message
        )

    def wait_for_text(self, selector, text, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.text_to_be_present_in_element(
                (By.CSS_SELECTOR, selector), text))

    def wait_for_nonempty_text(self, selector):
        # pylint: disable-next=unnecessary-lambda
        cond = lambda: self.driver.find_element_by_css_selector(selector).text.strip()
        if retry_until(cond):
            return True
        raise TimeoutException(
            f"Timed out waiting for text of {selector} to become non-empty")

    def wait_for_and_switch_to_frame(self, selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.frame_to_be_available_and_switch_to_it(
                (By.CSS_SELECTOR, selector)))

    def switch_to_window_with_url(self, url, max_tries=5):
        """Point the driver to the first window that matches this url."""

        for _ in range(max_tries):
            for w in self.driver.window_handles:
                try:
                    self.driver.switch_to.window(w)
                    if self.driver.current_url != url:
                        continue
                except NoSuchWindowException:
                    pass
                else:
                    return

            time.sleep(1)

        raise WindowNotFoundException("Failed to find window for " + url)


    def close_window_with_url(self, url, max_tries=5):
        self.switch_to_window_with_url(url, max_tries)

        if len(self.driver.window_handles) == 1:
            # open another window to avoid implicit session deletion
            self.open_window()
            self.switch_to_window_with_url(url, max_tries)

        self.driver.close()
        self.driver.switch_to.window(self.driver.window_handles[0])

    def block_domain(self, domain):
        self.load_url(self.options_url)
        self.js((
            "(function (domain) {"
            "  let bg = chrome.extension.getBackgroundPage();"
            "  let base_domain = window.getBaseDomain(domain);"
            "  bg.badger.heuristicBlocking.blocklistOrigin(base_domain, domain);"
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
        self.find_el_by_css('a[href="#tab-allowlist"]').click()
        self.driver.find_element_by_id('new-disabled-site-input').send_keys(url)
        self.driver.find_element_by_css_selector('#add-disabled-site').click()

    def get_domain_slider_state(self, domain):
        label = self.driver.find_element_by_css_selector(
            'input[name="{}"][checked]'.format(domain))
        return label.get_attribute('value')

    def load_pb_ui(self, target_url):
        """Show the PB popup as a new tab.

        If Selenium would let us just programmatically launch an extension from its icon,
        we wouldn't need this method. Alas it will not.

        But! We can open a new tab and set the url to the extension's popup html page and
        test away. That's how most devs test extensions. But**2!! PB's popup code uses
        the current tab's url to report the current tracker status.  And since we changed
        the current tab's url when we loaded the popup as a tab, the popup loses all the
        blocker status information from the original tab.

        The workaround is to execute a new convenience function in the popup codebase that
        looks for a given url in the tabs and, if it finds a match, refreshes the popup
        with the associated tabid. Then the correct status information will be displayed
        in the popup."""

        self.open_window()
        self.load_url(self.popup_url)

        # get the popup populated with status information for the correct url
        self.switch_to_window_with_url(self.popup_url)
        self.js("""
/**
 * if the query url pattern matches a tab, switch the module's tab object to that tab
 */
(function (url) {
  chrome.tabs.query({url}, function (tabs) {
    if (!tabs || !tabs.length) {
      return;
    }
    chrome.runtime.sendMessage({
      type: "getPopupData",
      tabId: tabs[0].id,
      tabUrl: tabs[0].url
    }, (response) => {
      setPopupData(response);
      refreshPopup();
      window.DONE_REFRESHING = true;
    });
  });
}(arguments[0]));""", target_url)

        # wait for popup to be ready
        self.wait_for_script(
            "return typeof window.DONE_REFRESHING != 'undefined' &&"
            "window.POPUP_INITIALIZED &&"
            "window.SLIDERS_DONE"
        )

    def get_tracker_state(self):
        """Parse the UI to group all third party origins into their respective action states."""

        notYetBlocked = {}
        cookieBlocked = {}
        blocked = {}

        domain_divs = self.driver.find_elements_by_css_selector(
            "#blockedResourcesInner > div.clicker[data-origin]")
        for div in domain_divs:
            domain = div.get_attribute('data-origin')

            # assert that this domain is never duplicated in the UI
            self.assertNotIn(domain, notYetBlocked)
            self.assertNotIn(domain, cookieBlocked)
            self.assertNotIn(domain, blocked)

            # get slider state for given domain
            action_type = self.get_domain_slider_state(domain)

            # non-tracking domains are hidden by default
            # so if we see a slider set to "allow",
            # it must be in the tracking-but-not-yet-blocked section
            if action_type == 'allow':
                notYetBlocked[domain] = True
            elif action_type == 'cookieblock':
                cookieBlocked[domain] = True
            elif action_type == 'block':
                blocked[domain] = True
            else:
                self.fail("what is this?!? %s" % action_type)

        return {
            'notYetBlocked': notYetBlocked,
            'cookieBlocked': cookieBlocked,
            'blocked': blocked
        }

    @property
    def logs(self):
        # TODO not yet in Firefox
        return [log.get('message') for log in self.driver.get_log('browser')]
