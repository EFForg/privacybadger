#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import os
from glob import glob
from xvfbwrapper import Xvfb
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from time import sleep


# PB_EXT_BG_URL_BASE = "chrome-extension://pkehgijcmpdhfbdbbnkijodmdjhbjlgp/"
PB_EXT_BG_URL_BASE = "chrome-extension://mcgekeccgjgcmhnhbabplanchdogjcnh/"
PB_CHROME_BG_URL = PB_EXT_BG_URL_BASE + "_generated_background_page.html"
PB_CHROME_OPTIONS_PAGE_URL = PB_EXT_BG_URL_BASE + "skin/options.html"
PB_CHROME_POPUP_URL = PB_EXT_BG_URL_BASE + "skin/popup.html"
PB_CHROME_FIRST_RUN_PAGE_URL = PB_EXT_BG_URL_BASE + "skin/firstRun.html"
SEL_DEFAULT_WAIT_TIMEOUT = 30


class PBSeleniumTest(unittest.TestCase):
    def setUp(self):
        env = os.environ
        # setting DBUS_SESSION_BUS_ADDRESS to nonsense prevents frequent
        # hangs of chromedriver (possibly due to crbug.com/309093).
        # https://github.com/SeleniumHQ/docker-selenium/issues/87#issuecomment-187580115
        env["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"
        self.browser_bin = env.get("BROWSER_BIN", "")  # o/w use WD's default
        self.pb_ext_path = self.get_extension_path()  # path to the extension
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

    def open_window(self):
        self.js('window.open()')
        self.driver.switch_to_window(self.driver.window_handles[-1])

    def load_url(self, url, wait_on_site=0):
        """Load a URL and wait before returning."""
        print("Will load %s" % url)
        self.driver.get(url)
        sleep(wait_on_site)

    def get_extension_path(self):
        """Return the path to the extension to be tested."""
        if "PB_EXT_PATH" in os.environ:
            return os.environ["PB_EXT_PATH"]
        else:  # check the default path if PB_EXT_PATH env. variable is empty
            print("Can't find the env. variable PB_EXT_PATH, will check ../..")
            # if the PB_EXT_PATH environment variable is not set
            # check the default location for the last modified crx file
            exts = glob("../../*.crx")  # get matching files
            return max(exts, key=os.path.getctime) if exts else ""

    def txt_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        """Find an element by CSS selector and return its text."""
        return self.find_el_by_css(css_selector, timeout).text

    def find_el_by_css(self, css_selector, timeout=SEL_DEFAULT_WAIT_TIMEOUT):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, css_selector)))

    def get_chrome_driver(self):
        """Setup and return a Chrom[e|ium] browser for Selenium."""
        opts = Options()
        absp = os.path.abspath
        if "TRAVIS" in os.environ:  # github.com/travis-ci/travis-ci/issues/938
            opts.add_argument("--no-sandbox")
        opts.add_extension(self.pb_ext_path)  # will fail if ext can't be found
        if self.browser_bin:  # otherwise will use webdriver's default binary
            print("Browser binary:", absp(self.browser_bin))
            opts.binary_location = self.browser_bin  # set binary location
        # Fix for https://code.google.com/p/chromedriver/issues/detail?id=799
        opts.add_experimental_option("excludeSwitches",
                                     ["ignore-certificate-errors"])
        prefs = {"profile.block_third_party_cookies": False}
        opts.add_experimental_option("prefs", prefs)
        return webdriver.Chrome(chrome_options=opts)

    def tearDown(self):
        self.driver.quit()
        if self.xvfb and self.vdisplay:
            self.vdisplay.stop()
