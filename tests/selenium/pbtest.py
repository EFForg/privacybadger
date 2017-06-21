#!/usr/bin/env python
# -*- coding: UTF-8 -*-
import os
import unittest
from contextlib import contextmanager
import subprocess
import time
from functools import wraps

from selenium import webdriver
from selenium.webdriver import DesiredCapabilities
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

SEL_DEFAULT_WAIT_TIMEOUT = 30

BROWSER_TYPES = ['chrome', 'firefox']
BROWSER_NAMES = ['google-chrome', 'google-chrome-stable', 'google-chrome-beta', 'firefox']


def parse_stdout(res):
    return res.strip().decode('utf-8')


def get_root():
    return parse_stdout(subprocess.check_output(['git', 'rev-parse', '--show-toplevel']))


def unix_which(command, silent=False):
    try:
        return parse_stdout(subprocess.check_output(['which', command]))
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
    if ('/' in string) or ('\\' in string):  # its a path
        return os.path.basename(string)
    else:  # its a browser type
        for bn in BROWSER_NAMES:
            if string in bn and unix_which(bn, silent=True):
                return os.path.basename(unix_which(bn))
        raise ValueError('Could not get browser name from %s' % string)


def build_crx():
    '''Builds the crx file for chrome and returns the path to it'''
    cmd = ['make', '-sC', get_root(), 'travisbuild']
    return os.path.join(get_root(), parse_stdout(subprocess.check_output(cmd).split()[-1]))


def get_ext_path(browser_type):
    if browser_type == 'chrome':
        return build_crx()
    elif browser_type == 'firefox':
        return os.path.join(get_root(), 'src')
    else:
        raise ValueError("bad browser type")


def set_config():
    '''
    Get a configuration from the supplied BROWSER environment variable.
    This function any of:
    * /path/to/a/browser
    * a browser executable name so we can find the browser with "which $BROWSER"
    * something from BROWSER_TYPES
    '''
    browser = os.environ['BROWSER']
    if ("/" in browser) or ("\\" in browser):  # path to a browser binary
        bpath = browser
        btype = get_browser_type(bpath)

    elif unix_which(browser, silent=True):  # executable browser name like 'google-chrome-stable'
        bpath = unix_which(browser)
        btype = get_browser_type(browser)

    elif get_browser_type(browser):  # browser type like 'firefox' or 'chrome'
        bname = get_browser_name(browser)
        bpath = unix_which(bname)
        btype = browser
    else:
        raise ValueError("could not infer BROWSER from %s" % browser)
    return bpath, btype, get_ext_path(btype)


print('configuring the test run: ')
browser_path, browser_type, extension_path = set_config()
print('Using browser path: %s \nwith browser type: %s \n and extension path: %s' % (browser_path, browser_type, extension_path))


def if_firefox(wrapper):
    '''
    A test decorator that applies the function `wrapper` to the test if the
    browser is firefox. Ex:

    @if_firefox(unittest.skip("broken on ff"))
    def test_stuff(self):
        ...
    '''
    def test_catcher(test):
        if browser_type == 'firefox':
            return wraps(test)(wrapper)(test)
        else:
            return test
    return test_catcher


attempts = {}  # used to count test retries
def repeat_if_failed(ntimes):
    '''
    A decorator that retries the test if it fails `ntimes`. The TestCase must
    be used on a subclass of unittest.TestCase. NB: this just register's function
    to be retried. The try/except logic is in PBSeleniumTest.run.
    '''
    def test_catcher(test):
        attempts[test.__name__] = ntimes

        @wraps(test)
        def caught(*args, **kwargs):
            return test(*args, **kwargs)
        return caught
    return test_catcher


def install_pb_on_ff(driver):
    params = {'path': extension_path, 'temporary': True, 'sessionId': driver.session_id}
    cmd = 'addonInstall'
    driver.command_executor._commands[cmd] = ('POST', '/session/$sessionId/moz/addon/install')
    driver.command_executor.execute(cmd, params)


@contextmanager
def firefox_manager(self):
    id_ = "jid1-MnnxcxisBPnSXQ@jetpack"
    uuid = "d56a5b99-51b6-4e83-ab23-796216679614"

    ffp = webdriver.FirefoxProfile()
    ffp.set_preference('extensions.webextensions.uuids', '{"%s": "%s"}' % (id_, uuid))

    driver = webdriver.Firefox(firefox_profile=ffp, firefox_binary=browser_path)
    install_pb_on_ff(driver)
    try:
        yield driver, 'moz-extension://%s/' % uuid
    finally:
        driver.quit()


@contextmanager
def chrome_manager(self):
    """Setup and return a Chrom[e|ium] browser for Selenium."""
    opts = Options()
    if "TRAVIS" in os.environ:  # github.com/travis-ci/travis-ci/issues/938
        opts.add_argument("--no-sandbox")
    opts.add_extension(extension_path)
    opts.binary_location = browser_path
    prefs = {"profile.block_third_party_cookies": False}
    opts.add_experimental_option("prefs", prefs)

    caps = DesiredCapabilities.CHROME.copy()
    caps['loggingPrefs'] = {'browser': 'ALL'}

    driver = webdriver.Chrome(chrome_options=opts, desired_capabilities=caps)
    try:
        yield driver, "chrome-extension://mcgekeccgjgcmhnhbabplanchdogjcnh/"
    finally:
        driver.quit()


def init(self, base_url, driver):
    self._logs = []
    self.base_url = base_url
    self.driver = driver
    self.driver.set_script_timeout(10)
    self.js = self.driver.execute_script


class PBSeleniumTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wants_xvfb = int(os.environ.get("ENABLE_XVFB", 1))
        if cls.wants_xvfb:
            from xvfbwrapper import Xvfb
            cls.vdisplay = Xvfb(width=1280, height=720)
            cls.vdisplay.start()

        # setting DBUS_SESSION_BUS_ADDRESS to nonsense prevents frequent
        # hangs of chromedriver (possibly due to crbug.com/309093).
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"
        cls.proj_root = get_root()
        if browser_type == 'firefox':
            cls.manager = firefox_manager
        else:
            cls.manager = chrome_manager

    @classmethod
    def tearDownClass(cls):
        if cls.wants_xvfb:
            cls.vdisplay.stop()

    def run(self, result=None):
        nretries = attempts.get(result.name, 1)
        for i in range(nretries):
            try:
                with self.manager() as (driver, base_url):
                    init(self, base_url, driver)
                    super(PBSeleniumTest, self).run(result)

                    # retry test magic
                    if result.name in attempts and result._excinfo:
                        raise Exception(result._excinfo.pop())
                    else:
                        break

            except Exception as e:
                if i == nretries - 1:
                    raise
                else:
                    print('Retrying test %s\n' % (result,))
                    continue

    def open_window(self):
        self.js('window.open()')
        self.driver.switch_to.window(self.driver.window_handles[-1])

    def load_url(self, url, wait_on_site=0):
        """Load a URL and wait before returning."""
        self.driver.get(url)
        time.sleep(wait_on_site)

    def txt_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        """Find an element by CSS selector and return its text."""
        return self.find_el_by_css(css_selector, timeout).text

    def find_el_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, css_selector)))

    def wait_for_script(self, script, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        """Variant of self.js that executes script continuously until it
        returns True."""
        return WebDriverWait(self.driver, timeout).until(
            lambda driver: driver.execute_script(script),
            "Timed out waiting for execute_script to eval to True"
        )

    @property
    def bg_url(self):
        return self.base_url + "_generated_background_page.html"

    @property
    def options_url(self):
        return self.base_url + "skin/options.html"

    @property
    def popup_url(self):
        return self.base_url + "skin/popup.html"

    @property
    def first_run_url(self):
        return self.base_url + "skin/firstRun.html"

    @property
    def test_url(self):
        return self.base_url + "tests/index.html"

    @property
    def cookieblocklist_path(self):
        return os.path.join(self.proj_root, 'doc/sample_cookieblocklist_legacy.txt')

    @property
    def url_to_handle_map(self):
        out = {}
        before = self.driver.current_window_handle
        for w in self.driver.window_handles:
            self.driver.switch_to.window(w)
            out[self.driver.current_url] = self.driver.current_window_handle
        self.driver.switch_to.window(before)
        return out

    @property
    def logs(self):
        def strip(l):
            return l.split('/')[-1]
        self._logs.extend([strip(l.get('message')) for l in self.driver.get_log('browser')])
        return self._logs
