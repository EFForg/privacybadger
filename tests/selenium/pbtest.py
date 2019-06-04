# -*- coding: UTF-8 -*-

import json
import os
import subprocess
import tempfile
import time
import unittest

from contextlib import contextmanager
from functools import wraps
from shutil import copytree

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver import DesiredCapabilities
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By


SEL_DEFAULT_WAIT_TIMEOUT = 30

BROWSER_TYPES = ['chrome', 'firefox']
BROWSER_NAMES = ['google-chrome', 'google-chrome-stable', 'google-chrome-beta', 'firefox']

parse_stdout = lambda res: res.strip().decode('utf-8')

run_shell_command = lambda command: parse_stdout(subprocess.check_output(command))

GIT_ROOT = run_shell_command(['git', 'rev-parse', '--show-toplevel'])


def unix_which(command, silent=False):
    try:
        return run_shell_command(['which', command])
    except subprocess.CalledProcessError as e:
        if silent:
            return None
        raise e


def get_browser_type(string):
    for t in BROWSER_TYPES:
        if t in string:
            return t
    raise ValueError("couldn't get browser type from %s" % string)


def get_browser_name(string):
    if ('/' in string) or ('\\' in string): # it's a path
        return os.path.basename(string)
    else: # it's a browser type
        for bn in BROWSER_NAMES:
            if string in bn and unix_which(bn, silent=True):
                return os.path.basename(unix_which(bn))
        raise ValueError('Could not get browser name from %s' % string)


def install_ext_on_ff(driver, extension_path):
    '''
    Use Selenium's internal API's to manually send a message to geckodriver
    to install the extension. We should remove this once the functionality is
    included in Selenium. See https://github.com/SeleniumHQ/selenium/issues/4215
    '''
    command = 'addonInstall'
    driver.command_executor._commands[command] = ( # pylint:disable=protected-access
        'POST', '/session/$sessionId/moz/addon/install')
    driver.execute(command, params={'path': extension_path, 'temporary': True})
    time.sleep(2)


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
        elif ("/" in browser) or ("\\" in browser): # path to a browser binary
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

        caps = DesiredCapabilities.CHROME.copy()
        caps['loggingPrefs'] = {'browser': 'ALL'}

        for i in range(5):
            try:
                driver = webdriver.Chrome(options=opts, desired_capabilities=caps)
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

        for i in range(5):
            try:
                opts = FirefoxOptions()
                #opts.log.level = "trace"
                driver = webdriver.Firefox(
                    firefox_profile=ffp,
                    firefox_binary=self.browser_path,
                    options=opts
                )
            except WebDriverException as e:
                if i == 0: print("")
                print("Firefox WebDriver initialization failed:")
                print(str(e) + "Retrying ...")
            else:
                break

        install_ext_on_ff(driver, self.extension_path)

        try:
            yield driver
        finally:
            driver.quit()


shim = Shim() # create the browser shim


def if_firefox(wrapper):
    '''
    A test decorator that applies the function `wrapper` to the test if the
    browser is firefox. Ex:

    @if_firefox(unittest.skip("broken on ff"))
    def test_stuff(self):
        ...
    '''
    def test_catcher(test):
        if shim.browser_type == 'firefox':
            return wraps(test)(wrapper)(test)
        return test

    return test_catcher


def retry_until(fun, tester=None, times=5, msg="Waiting a bit and retrying ..."):
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

        if i == 0:
            print("")
        print(msg)

        time.sleep(2 ** i)

    return result


attempts = {} # used to count test retries
def repeat_if_failed(ntimes): # noqa
    '''
    A decorator that retries the test if it fails `ntimes`. The TestCase must
    be used on a subclass of unittest.TestCase. NB: this just registers function
    to be retried. The try/except logic is in PBSeleniumTest.run.
    '''
    def test_catcher(test):
        attempts[test.__name__] = ntimes

        @wraps(test)
        def caught(*args, **kwargs):
            return test(*args, **kwargs)
        return caught
    return test_catcher


class PBSeleniumTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manager = shim.manager
        cls.base_url = shim.base_url
        cls.wants_xvfb = shim.wants_xvfb
        if cls.wants_xvfb:
            from xvfbwrapper import Xvfb
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
        self._logs = []
        self.driver = driver
        self.js = self.driver.execute_script
        self.bg_url = self.base_url + "_generated_background_page.html"
        self.options_url = self.base_url + "skin/options.html"
        self.popup_url = self.base_url + "skin/popup.html"
        self.first_run_url = self.base_url + "skin/firstRun.html"
        self.test_url = self.base_url + "tests/index.html"

    def run(self, result=None):
        nretries = attempts.get(result.name, 1)
        for i in range(nretries):
            try:
                with self.manager() as driver:
                    self.init(driver)

                    # wait for Badger's storage, listeners, ...
                    self.load_url(self.options_url)
                    self.wait_for_script(
                        "return chrome.extension.getBackgroundPage().badger.INITIALIZED"
                        # TODO wait for loadSeedData's completion (not yet covered by INITIALIZED)
                        " && Object.keys("
                        "chrome.extension.getBackgroundPage()"
                        ".badger.storage.getBadgerStorageObject('action_map').getItemClones()"
                        ").length > 1",
                    )
                    driver.close()
                    if driver.window_handles:
                        driver.switch_to.window(driver.window_handles[0])

                    super(PBSeleniumTest, self).run(result)

                    # retry test magic
                    if result.name in attempts and result._excinfo: # pylint:disable=protected-access
                        raise Exception(result._excinfo.pop()) # pylint:disable=protected-access
                    else:
                        break

            except Exception:
                if i == nretries - 1:
                    raise
                else:
                    wait_secs = 2 ** i
                    print('\nRetrying {} after {} seconds ...'.format(
                        result, wait_secs))
                    time.sleep(wait_secs)
                    continue

    def open_window(self):
        if self.driver.current_url.startswith("moz-extension://"):
            # work around https://bugzilla.mozilla.org/show_bug.cgi?id=1491443
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
        self.driver.switch_to.window(self.driver.current_window_handle)

        if wait_for_body_text:
            retry_until(
                lambda: self.driver.find_element_by_tag_name('body').text,
                msg="Waiting for document.body.textContent to get populated ..."
            )

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
        timeout=SEL_DEFAULT_WAIT_TIMEOUT,
        message="Timed out waiting for execute_script to eval to True"
    ):
        """Variant of self.js that executes script continuously until it
        returns True."""
        return WebDriverWait(self.driver, timeout).until(
            lambda driver: driver.execute_script(script),
            message
        )

    def wait_for_text(self, selector, text, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.text_to_be_present_in_element(
                (By.CSS_SELECTOR, selector), text))

    def wait_for_and_switch_to_frame(self, selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.frame_to_be_available_and_switch_to_it(
                (By.CSS_SELECTOR, selector)))

    @property
    def logs(self):
        def strip(l):
            return l.split('/')[-1]
        self._logs.extend([strip(l.get('message')) for l in self.driver.get_log('browser')])
        return self._logs
