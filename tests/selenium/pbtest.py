#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import os
from glob import glob
from time import sleep
from contextlib import contextmanager
import subprocess
import time

from xvfbwrapper import Xvfb
from selenium import webdriver
from selenium.webdriver import DesiredCapabilities
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By


def get_extension_path():
    """Return the path to the extension to be tested."""
    if "PB_EXT_PATH" in os.environ:
        return os.environ["PB_EXT_PATH"]
    else:  # check the default path if PB_EXT_PATH env. variable is empty
        print("Can't find the env. variable PB_EXT_PATH, will check ../..")
        # if the PB_EXT_PATH environment variable is not set
        # check the default location for the last modified crx file
        exts = glob("../../*.crx")  # get matching files
        return max(exts, key=os.path.getctime) if exts else ""


@contextmanager
def xvfb_manager(env):
    wants_xvfb = int(env.get("ENABLE_XVFB", 0))
    if wants_xvfb:
        vdisplay = Xvfb(width=1280, height=720)
        vdisplay.start()
        try:
            yield vdisplay
        finally:
            vdisplay.stop()
    else:
        yield


@contextmanager
def driver_manager(driver):
    try:
        yield driver
    finally:
        driver.quit()


@contextmanager
def firefox_manager():
    cmd = ['./firefox_selenium.sh']
    proc = subprocess.Popen(cmd)
    time.sleep(2)
    ffcaps = DesiredCapabilities.FIREFOX
    try:
        driver = webdriver.Remote('http://127.0.0.1:4444', ffcaps)
        time.sleep(2)
        while driver.window_handles < 2:
            pass

        with driver_manager(driver):
            yield driver
    finally:
        proc.terminate()


@contextmanager
def chrome_manager():
    """Setup and return a Chrom[e|ium] browser for Selenium."""
    opts = Options()
    browser_bin = os.environ.get("BROWSER_BIN", "")
    if "TRAVIS" in os.environ:  # github.com/travis-ci/travis-ci/issues/938
        opts.add_argument("--no-sandbox")
    opts.add_extension(get_extension_path())  # will fail if ext can't be found
    if browser_bin:  # otherwise will use webdriver's default binary
        opts.binary_location = browser_bin  # set binary location
    # Fix for https://code.google.com/p/chromedriver/issues/detail?id=799
    opts.add_experimental_option("excludeSwitches",
                                 ["ignore-certificate-errors"])
    prefs = {"profile.block_third_party_cookies": False}
    opts.add_experimental_option("prefs", prefs)
    driver = webdriver.Chrome(chrome_options=opts)
    with driver_manager(driver):
        yield driver


PB_EXT_BG_URL_BASE = "chrome-extension://mcgekeccgjgcmhnhbabplanchdogjcnh/"
PB_CHROME_BG_URL = PB_EXT_BG_URL_BASE + "_generated_background_page.html"
PB_CHROME_OPTIONS_PAGE_URL = PB_EXT_BG_URL_BASE + "skin/options.html"
PB_CHROME_POPUP_URL = PB_EXT_BG_URL_BASE + "skin/popup.html"
PB_CHROME_FIRST_RUN_PAGE_URL = PB_EXT_BG_URL_BASE + "skin/firstRun.html"
SEL_DEFAULT_WAIT_TIMEOUT = 30


class PBSeleniumTest(unittest.TestCase):
    def run(self, result=None):
        env = os.environ
        if env.get('BROWSER') == 'firefox':
            manager = firefox_manager
        else:
            manager = chrome_manager

        with xvfb_manager(env) as xvfb:
            with manager() as driver:
                self.xvfb = xvfb
                self.driver = driver
                self.js = self.driver.execute_script
                super(PBSeleniumTest, self).run(result)

    '''
    def setUp(self):
        env = os.environ
        # setting DBUS_SESSION_BUS_ADDRESS to nonsense prevents frequent
        # hangs of chromedriver (possibly due to crbug.com/309093).
        # https://github.com/SeleniumHQ/docker-selenium/issues/87#issuecomment-187580115
        env["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"
        self.browser_bin = env.get("BROWSER_BIN", "")  # o/w use WD's default
        self.pb_ext_path = get_extension_path()  # path to the extension
        self.xvfb = int(env.get("ENABLE_XVFB", 0))
        # We start an xvfb on Travis, don't need to do it twice.
        if "TRAVIS" not in os.environ and self.xvfb:
            self.vdisplay = Xvfb(width=1280, height=720)
            self.vdisplay.start()
        else:
            self.xvfb = 0

        self.driver = self.get_chrome_driver()
        print("\nSuccessfully initialized the chromedriver")
        self.js = self.driver.execute_script

    def tearDown(self):
        self.driver.quit()
        if self.xvfb and self.vdisplay:
            self.vdisplay.stop()
    '''

    def open_window(self):
        self.js('window.open()')
        self.driver.switch_to_window(self.driver.window_handles[-1])

    def load_url(self, url, wait_on_site=0):
        """Load a URL and wait before returning."""
        print("Will load %s" % url)
        self.driver.get(url)
        sleep(wait_on_site)

    def txt_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        """Find an element by CSS selector and return its text."""
        return self.find_el_by_css(css_selector, timeout).text

    def find_el_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, css_selector)))

    def get_ext_url(self):
        if os.environ.get('BROWSER') != 'firefox':
            return PB_EXT_BG_URL_BASE
        if hasattr(self, '_url') and self._url is not None:
            return self._url
        prof_dir = self.driver.capabilities['moz:profile']
        prefsjs = prof_dir + '/prefs.js'

        with open(prefsjs, 'r') as fp:
            data = fp.readlines()
            for l in data:
                if l.startswith('user_pref("extensions.webextensions.uuids"'):
                    break
        # got the line, now get the uuid
        uuid = l.split(':')[-1][2:-7]
        self._url = 'moz-extension://' + uuid + '/'
        return self._url

    def get_ext_bg_url(self):
        return self.get_ext_url() + "_generated_background_page.html"
