#!/usr/bin/env python3

import functools
import json
import os
import re
import tempfile
import time
import unittest

from contextlib import contextmanager
from shutil import copytree, which

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchWindowException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

try:
    from xvfbwrapper import Xvfb
except ImportError:
    print("\n\nxvfbwrapper Python package import failed")
    print("headless mode (ENABLE_XVFB=1) is not supported")


SEL_DEFAULT_WAIT_TIMEOUT = 30

BROWSER_TYPES = ['chrome', 'firefox', 'edge']
BROWSER_NAMES = ['google-chrome', 'google-chrome-stable', 'google-chrome-beta', 'firefox', 'microsoft-edge', 'microsoft-edge-beta']


class WindowNotFoundException(Exception):
    pass


def get_browser_type(string):
    for t in BROWSER_TYPES:
        if t in string.lower():
            return t
    raise ValueError(f"Could not get browser type from {string}")


def get_browser_name(string):
    for bn in BROWSER_NAMES:
        if string in bn:
            bn_path = which(bn)
            if bn_path:
                return os.path.basename(bn_path)
    raise ValueError(f"Could not get browser name from {string}")


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

        if ("/" in browser) or ("\\" in browser):
            # path to a browser binary
            self.browser_path = browser
            self.browser_type = get_browser_type(browser)
        elif which(browser):
            # executable browser name like 'google-chrome-stable'
            self.browser_path = which(browser)
            self.browser_type = get_browser_type(browser)
        elif get_browser_type(browser):
            # browser type like 'firefox' or 'chrome'
            bname = get_browser_name(browser)
            self.browser_path = which(bname)
            self.browser_type = get_browser_type(browser)
        else:
            raise ValueError(f"Could not infer BROWSER from {browser}")

        self.extension_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

        if self.browser_type in ('chrome', 'edge'):
            # this extension ID and the "key" property in manifest.json
            # must both be derived from the same private key
            self.info = {
                'extension_id': 'mcgekeccgjgcmhnhbabplanchdogjcnh'
            }
            self.base_url = f"chrome-extension://{self.info['extension_id']}/"
            if self.browser_type == 'chrome':
                self.manager = self.chrome_manager
            else:
                self.manager = self.edge_manager

            # make extension ID constant across runs
            self.fix_chrome_extension_id()

        elif self.browser_type == 'firefox':
            self.info = {
                'extension_id': 'jid1-MnnxcxisBPnSXQ@jetpack',
                'uuid': 'd56a5b99-51b6-4e83-ab23-796216679614'
            }
            self.manager = self.firefox_manager
            self.base_url = f"moz-extension://{self.info['uuid']}/"

        print(f"\nUsing browser path: {self.browser_path}\n"
              f"with browser type: {self.browser_type}\n"
              f"and extension path: {self.extension_path}\n")

    def fix_chrome_extension_id(self):
        # create temp directory
        # pylint: disable-next=consider-using-with
        self.tmp_dir = tempfile.TemporaryDirectory()
        new_extension_path = os.path.join(self.tmp_dir.name, "src")

        # copy extension sources there
        copytree(self.extension_path, new_extension_path)

        # update manifest.json
        manifest_path = os.path.join(new_extension_path, "manifest.json")
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        # this key and the extension ID must both be derived from the same private key
        manifest['key'] = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArMdgFkGsm7nOBr/9qkx8XEcmYSu1VkIXXK94oXLz1VKGB0o2MN+mXL/Dsllgkh61LZgK/gVuFFk89e/d6Vlsp9IpKLANuHgyS98FKx1+3sUoMujue+hyxulEGxXXJKXhk0kGxWdE0IDOamFYpF7Yk0K8Myd/JW1U2XOoOqJRZ7HR6is1W6iO/4IIL2/j3MUioVqu5ClT78+fE/Fn9b/DfzdX7RxMNza9UTiY+JCtkRTmm4ci4wtU1lxHuVmWiaS45xLbHphQr3fpemDlyTmaVoE59qG5SZZzvl6rwDah06dH01YGSzUF1ezM2IvY9ee1nMSHEadQRQ2sNduNZWC9gwIDAQAB" # noqa:E501 pylint:disable=line-too-long
        with open(manifest_path, "w", encoding="utf-8") as f:
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
        opts.add_argument("--load-extension=" + self.extension_path)
        opts.binary_location = self.browser_path

        # TODO not yet in Firefox (w/o hacks anyway):
        # https://github.com/mozilla/geckodriver/issues/284#issuecomment-456073771
        opts.set_capability("goog:loggingPrefs", {'browser': 'ALL'})

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
    def edge_manager(self):
        opts = EdgeOptions()
        opts.add_argument("--load-extension=" + self.extension_path)
        opts.binary_location = self.browser_path

        for i in range(5):
            try:
                driver = webdriver.Edge(options=opts)
            except WebDriverException as e:
                if i == 0: print("")
                print("Edge WebDriver initialization failed:")
                print(str(e) + "Retrying ...")
            else:
                break

        try:
            yield driver
        finally:
            driver.quit()

    @contextmanager
    def firefox_manager(self):
        for i in range(5):
            try:
                opts = FirefoxOptions()

                opts.binary_location = self.browser_path

                # make extension ID constant across runs
                opts.set_preference('extensions.webextensions.uuids', '{"%s": "%s"}' % (
                    self.info['extension_id'], self.info['uuid']))

                # needed for test_referrer_header()
                # https://bugzilla.mozilla.org/show_bug.cgi?id=1720294
                opts.set_preference('network.http.referer.disallowCrossSiteRelaxingDefault', False)

                # disable tracker cookie blocking as it breaks cookie tests
                # that use trackersimulator.org, a "known tracker",
                # and disable cookie site isolation, as it breaks the cookie
                # tracking detection test
                opts.set_preference("network.cookie.cookieBehavior", 0)

                # to produce a trace-level geckodriver.log,
                # remove the log_output argument to FirefoxService()
                # and uncomment the line below
                #opts.log.level = "trace"

                service = FirefoxService(log_output=os.path.devnull)
                driver = webdriver.Firefox(options=opts, service=service)

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

    @classmethod
    def tearDownClass(cls):
        if cls.wants_xvfb:
            cls.vdisplay.stop()

    def init(self, driver):
        self.driver = driver
        self.js = self.driver.execute_script
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
                "let done = arguments[arguments.length - 1];"
                "chrome.runtime.sendMessage({"
                "  type: 'isBadgerInitialized'"
                "}, r => done(r));", execute_async=True)
            # also disable the welcome page
            self.driver.execute_async_script(
                "let done = arguments[arguments.length - 1];"
                "chrome.runtime.sendMessage({"
                "  type: 'updateSettings',"
                "  data: { showIntroPage: false }"
                "}, () => {"
                "   chrome.tabs.query({}, (res) => {"
                "     let welcome_tab = res && res.find("
                "       tab => tab.url == chrome.runtime.getURL('skin/firstRun.html'));"
                "     if (!welcome_tab) {"
                "       return done();"
                "     }"
                "     chrome.tabs.remove(welcome_tab.id, done);"
                "   });"
                "});")
            super().run(result)

    def is_firefox_nightly(self):
        caps = self.driver.capabilities
        if caps['browserName'] == "firefox":
            version = caps['browserVersion']
            return re.search('a[0-9]+$', version) is not None
        return False

    def open_window(self):
        try:
            self.driver.switch_to.new_window('tab')
        except NoSuchWindowException:
            time.sleep(1)
            self.driver.switch_to.new_window('tab')

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
                lambda: self.driver.find_element(By.TAG_NAME, 'body').text)

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

    @contextmanager
    def wait_for_window_close(self, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        num_windows = len(self.driver.window_handles)
        yield
        WebDriverWait(self.driver, timeout).until(
            lambda d: len(d.window_handles) + 1 == num_windows)

    @contextmanager
    def wait_for_reload(self, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        """Context manager that waits for the page to reload,
        to be used with actions that reload the page."""
        page = self.driver.find_element(By.TAG_NAME, 'html')
        yield
        try:
            WebDriverWait(self.driver, timeout).until(EC.staleness_of(page))
        except WebDriverException as e:
            # work around Firefox nonsense
            if str(e).startswith("Message: TypeError: can't access dead object"):
                pass
            else:
                raise e

    def wait_for_script(self, script, *script_args,
        timeout=SEL_DEFAULT_WAIT_TIMEOUT, execute_async=False,
        message="Timed out waiting for execute_script to eval to True"):

        """Variant of execute_script/execute_async_script
        that keeps rerunning the script until it returns True."""

        def execute_script(dr):
            if execute_async: return dr.execute_async_script(script, *script_args)
            return dr.execute_script(script, *script_args)

        return WebDriverWait(self.driver, timeout).until(execute_script, message)

    def wait_for_text(self, selector, text, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.text_to_be_present_in_element(
                (By.CSS_SELECTOR, selector), text))

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
                except WebDriverException as e:
                    if "cannot determine loading status" in str(e):
                        pass
                    else:
                        raise e
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

    def set_dnt(self, domain):
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'setDnt',"
            "  domain: arguments[0]"
            "}, done);", domain)

        # poll for DNR to get updated
        self.wait_for_script(
            "let done = arguments[arguments.length - 1];"
            "(async function (domain) {"
            "  let { default: constants } = await import('../js/constants.js');"
            "  let rules = await chrome.declarativeNetRequest.getDynamicRules();"
            "  done(rules.find(r => {"
            "    if (r.action.type == 'allow' &&"
            "      r.priority == constants.DNR_DNT_ALLOW &&"
            "      r.condition.requestDomains.includes(domain)) {"
            "      return true;"
            "    }"
            "    return false;"
            "  }));"
            "}(arguments[0]));", domain, execute_async=True, timeout=3)

    def check_dnt(self, domain):
        self.load_url(self.options_url)
        return self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'checkForDntPolicy',"
            "  domain: arguments[0]"
            "}, done);", domain)

    def set_user_action(self, domain, action):
        """Adds or modifies the action_map entry for `domain`,
        setting userAction to "user_" + `action`."""
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'saveOptionsToggle',"
            "  origin: arguments[0],"
            "  action: arguments[1]"
            "}, done);", domain, action)

        # poll for DNR to get updated
        self.wait_for_script(
            "let done = arguments[arguments.length - 1];"
            "(async function (domain, action) {"
            "  let { default: constants } = await import('../js/constants.js');"
            "  let rules = await chrome.declarativeNetRequest.getDynamicRules();"
            "  done(rules.find(r => {"
            "    if (action == 'block') {"
            "      if (r.action.type == 'block' &&"
            "        r.priority == constants.DNR_USER_BLOCK &&"
            "        r.condition.requestDomains.includes(domain)) {"
            "        return true;"
            "      }"
            "    } else if (action == 'cookieblock') {"
            "      if (r.action.type == 'modifyHeaders' &&"
            "        r.priority == constants.DNR_USER_COOKIEBLOCK_HEADERS &&"
            "        r.condition.requestDomains.includes(domain)) {"
            "        return true;"
            "      }"
            "    } else if (action == 'allow') {"
            "      if (r.action.type == 'allow' &&"
            "        r.priority == constants.DNR_USER_ALLOW &&"
            "        r.condition.requestDomains.includes(domain)) {"
            "        return true;"
            "      }"
            "    }"
            "    return false;"
            "  }));"
            "}(arguments[0], arguments[1]));", domain, action, execute_async=True, timeout=3)

    def add_domain(self, domain, action):
        """Adds or modifies the action_map entry for `domain`,
        setting heuristicAction to `action`."""
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1],"
            "  domain = arguments[0],"
            "  action = arguments[1];"
            "chrome.runtime.sendMessage({"
            "  type: 'setAction', domain, action"
            "}, done);", domain, action)

        if action == "allow":
            return

        # poll for DNR to get updated
        self.wait_for_script(
            "let done = arguments[arguments.length - 1];"
            "(async function (domain, action) {"
            "  let { default: constants } = await import('../js/constants.js');"
            "  let rules = await chrome.declarativeNetRequest.getDynamicRules();"
            "  done(rules.find(r => {"
            "    if (action == 'block') {"
            "      if (r.action.type == 'block' &&"
            "        r.priority == constants.DNR_BLOCK &&"
            "        r.condition.requestDomains &&"
            "        r.condition.requestDomains.includes(domain)) {"
            "        return true;"
            "      }"
            "    } else if (action == 'cookieblock') {"
            "      if (r.action.type == 'modifyHeaders' &&"
            "        r.priority == constants.DNR_COOKIEBLOCK_HEADERS &&"
            "        r.condition.requestDomains.includes(domain)) {"
            "        return true;"
            "      }"
            "    }"
            "    return false;"
            "  }));"
            "}(arguments[0], arguments[1]));", domain, action, execute_async=True, timeout=3)

    def block_domain(self, domain):
        self.add_domain(domain, "block")

    def cookieblock_domain(self, domain):
        self.add_domain(domain, "cookieblock")

    def disable_badger_on_site(self, url):
        self.load_url(self.options_url)
        self.wait_for_script("return window.OPTIONS_INITIALIZED")
        self.find_el_by_css('a[href="#tab-allowlist"]').click()
        self.driver.find_element(By.ID, 'new-disabled-site-input').send_keys(url)
        self.driver.find_element(By.CSS_SELECTOR, '#add-disabled-site').click()
        # poll for DNR to get updated
        self.wait_for_script(
            "let done = arguments[arguments.length - 1];"
            "(async function (url) {"
            "  const { default: utils } = await import('../js/utils.js');"
            "  let domain = utils.getHostFromDomainInput(url);"
            "  if (domain.startsWith('*')) {"
            "    domain = domain.slice(1);"
            "    if (domain.startsWith('.')) {"
            "      domain = domain.slice(1);"
            "    }"
            "  }"
            "  chrome.declarativeNetRequest.getDynamicRules(rules => {"
            "    done(rules.find(r =>"
            "      r.action.type == 'allowAllRequests' &&"
            "        r.condition.requestDomains.includes(domain)));"
            "  });"
            "}(arguments[0]));", url, execute_async=True, timeout=3)

    def reenable_badger_on_site(self, domain):
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'reenableOnSites',"
            "  domains: [arguments[0]]"
            "}, done);", domain)
        # poll for DNR to get updated
        self.wait_for_script(
            "let done = arguments[arguments.length - 1];"
            "(function (domain) {"
            "  chrome.declarativeNetRequest.getDynamicRules(rules => {"
            "    done(!rules.find(r =>"
            "      r.action.type == 'allowAllRequests' &&"
            "        r.condition.requestDomains.includes(domain)));"
            "  });"
            "}(arguments[0]));", domain, execute_async=True, timeout=3)

    def get_domain_slider_state(self, domain):
        label = self.driver.find_element(
            By.CSS_SELECTOR, f'input[name="{domain}"][checked]')
        return label.get_attribute('value')

    def clear_tracker_data(self):
        self.load_url(self.options_url)
        self.driver.execute_async_script(
            "let done = arguments[arguments.length - 1];"
            "chrome.runtime.sendMessage({"
            "  type: 'removeAllData'"
            "}, done);")

    def get_badger_storage(self, store_name):
        self.load_url(self.options_url)
        return self.driver.execute_async_script((
            "let done = arguments[arguments.length - 1],"
            "  store_name = arguments[0];"
            "chrome.runtime.sendMessage({"
            "  type: 'syncStorage',"
            "  storeName: store_name"
            "}, function () {"
            "  chrome.storage.local.get([store_name], function (res) {"
            "    done(res[store_name]);"
            "  });"
            "});"
        ), store_name)

    def open_popup(self, target_url=None, show_reminder=False):
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
        self.wait_for_script("return window.POPUP_INITIALIZED")

        # get the popup populated with status information for the correct url
        self.js("""
/**
 * @param {String} [url]
 * @param {Boolean} [show_reminder]
 */
(function (url, show_reminder) {
  let queryOpts = { currentWindow: true };
  if (url) {
    queryOpts = { url };
  }
  chrome.tabs.query(queryOpts, function (tabs) {
    if (!tabs || !tabs.length) {
      return;
    }
    chrome.runtime.sendMessage({
      type: "getPopupData",
      tabId: tabs[0].id,
      tabUrl: tabs[0].url
    }, (response) => {
      response.settings.seenComic = !show_reminder;
      setPopupData(response);
      refreshPopup();
      showNagMaybe(); // not init() because init() already ran and should only run once
      window.DONE_REFRESHING = true;
    });
  });
}(arguments[0], arguments[1]));""", target_url, show_reminder)

        # wait for popup to be ready
        self.wait_for_script("return window.DONE_REFRESHING && window.SLIDERS_DONE")

    def get_tracker_state(self):
        """Parse the UI to group all third party origins into their respective action states."""

        notYetBlocked = {}
        cookieBlocked = {}
        blocked = {}

        domain_divs = self.driver.find_elements(By.CSS_SELECTOR,
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
                self.fail(f"what is this?!? {action_type}")

        return {
            'notYetBlocked': notYetBlocked,
            'cookieBlocked': cookieBlocked,
            'blocked': blocked
        }

    @property
    def logs(self):
        # TODO not yet in Firefox
        return [log.get('message') for log in self.driver.get_log('browser')]
