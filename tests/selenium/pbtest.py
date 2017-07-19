# -*- coding: UTF-8 -*-
import os
import unittest
from contextlib import contextmanager
from collections import namedtuple
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

Specifics = namedtuple('Specifics', ['manager', 'background_url', 'info'])

firefox_info = {'extension_id': 'jid1-MnnxcxisBPnSXQ@jetpack', 'uuid': 'd56a5b99-51b6-4e83-ab23-796216679614'}
chrome_info = {'extension_id': 'mcgekeccgjgcmhnhbabplanchdogjcnh'}

parse_stdout = lambda res: res.strip().decode('utf-8')

run_shell_command = lambda command: parse_stdout(subprocess.check_output(command))

get_git_root = lambda: run_shell_command(['git', 'rev-parse', '--show-toplevel'])


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
    if ('/' in string) or ('\\' in string):  # its a path
        return os.path.basename(string)
    else:  # its a browser type
        for bn in BROWSER_NAMES:
            if string in bn and unix_which(bn, silent=True):
                return os.path.basename(unix_which(bn))
        raise ValueError('Could not get browser name from %s' % string)


def build_crx():
    '''Builds the .crx file for Chrome and returns the path to it'''
    cmd = ['make', '-sC', get_git_root(), 'travisbuild']
    return os.path.join(get_git_root(), run_shell_command(cmd).split()[-1])


def install_ext_on_ff(driver, extension_path):
    '''
    Use Selenium's internal API's to manually send a message to geckodriver
    to install the extension. We should remove this once the functionality is
    included in Selenium. See https://github.com/SeleniumHQ/selenium/issues/4215
    '''
    command = 'addonInstall'
    driver.command_executor._commands[command] = ('POST', '/session/$sessionId/moz/addon/install')
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
        print('Configuring the test run')
        self._specifics = None
        browser = os.environ.get('BROWSER')
        # get browser_path and broser_type first
        if browser is None:
            raise ValueError("The BROWSER environment variable is not set. " + self._browser_msg)
        elif ("/" in browser) or ("\\" in browser):  # path to a browser binary
            self.browser_path = browser
            self.browser_type = get_browser_type(self.browser_path)

        elif unix_which(browser, silent=True):  # executable browser name like 'google-chrome-stable'
            self.browser_path = unix_which(browser)
            self.browser_type = get_browser_type(browser)

        elif get_browser_type(browser):  # browser type like 'firefox' or 'chrome'
            bname = get_browser_name(browser)
            self.browser_path = unix_which(bname)
            self.browser_type = browser
        else:
            raise ValueError("could not infer BROWSER from %s" % browser)

        self.extension_path = self.get_ext_path()
        self._set_specifics()
        print('\nUsing browser path: %s \nwith browser type: %s \nand extension path: %s' %
              (self.browser_path, self.browser_type, self.extension_path))

    def _set_specifics(self):
        self._specifics = self._specifics or {
            'chrome': Specifics(self.chrome_manager, 'chrome-extension://%s/' % chrome_info['extension_id'], chrome_info),
            'firefox': Specifics(self.firefox_manager, 'moz-extension://%s/' % firefox_info['uuid'], firefox_info)}
        self.manager, self.bg_url, self.info = self._specifics[self.browser_type]

    def get_ext_path(self):
        if self.browser_type == 'chrome':
            return build_crx()
        elif self.browser_type == 'firefox':
            return os.path.join(get_git_root(), 'src')
        else:
            raise ValueError("bad browser getting extension path")

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
        opts = Options()
        if self.on_travis:  # github.com/travis-ci/travis-ci/issues/938
            opts.add_argument("--no-sandbox")
        opts.add_extension(self.extension_path)
        opts.binary_location = self.browser_path
        opts.add_experimental_option("prefs", {"profile.block_third_party_cookies": False})

        caps = DesiredCapabilities.CHROME.copy()
        caps['loggingPrefs'] = {'browser': 'ALL'}

        driver = webdriver.Chrome(chrome_options=opts, desired_capabilities=caps)
        try:
            yield driver
        finally:
            driver.quit()

    @contextmanager
    def firefox_manager(self):
        ffp = webdriver.FirefoxProfile()
        # make extension id constant across runs
        ffp.set_preference('extensions.webextensions.uuids', '{"%s": "%s"}' %
                           (self.info['extension_id'], self.info['uuid']))

        driver = webdriver.Firefox(firefox_profile=ffp, firefox_binary=self.browser_path)
        install_ext_on_ff(driver, self.extension_path)
        try:
            yield driver
        finally:
            time.sleep(2)
            driver.quit()
            time.sleep(2)


shim = Shim()  # create the browser shim


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
        else:
            return test
    return test_catcher


attempts = {}  # used to count test retries
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
        cls.base_url = shim.bg_url
        cls.wants_xvfb = shim.wants_xvfb
        if cls.wants_xvfb:
            from xvfbwrapper import Xvfb
            cls.vdisplay = Xvfb(width=1280, height=720)
            cls.vdisplay.start()

        # setting DBUS_SESSION_BUS_ADDRESS to nonsense prevents frequent
        # hangs of chromedriver (possibly due to crbug.com/309093).
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"
        cls.proj_root = get_git_root()
        cls.cookieblocklist_path = os.path.join(cls.proj_root, 'doc/sample_cookieblocklist_legacy.txt')

    @classmethod
    def tearDownClass(cls):
        if cls.wants_xvfb:
            cls.vdisplay.stop()

    def init(self, driver):
        self._logs = []
        self.driver = driver
        self.driver.set_script_timeout(10)
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
                    wait_secs = 2 ** i
                    print('\nRetrying {} after {} seconds ...'.format(
                        result, wait_secs))
                    time.sleep(wait_secs)
                    continue

    def open_window(self):
        self.js('window.open()')
        self.driver.switch_to.window(self.driver.window_handles[-1])

    def load_url(self, url, wait_on_site=0):
        """Load a URL and wait before returning."""
        self.driver.get(url)
        self.driver.switch_to.window(self.driver.current_window_handle)
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
    def logs(self):
        def strip(l):
            return l.split('/')[-1]
        self._logs.extend([strip(l.get('message')) for l in self.driver.get_log('browser')])
        return self._logs
