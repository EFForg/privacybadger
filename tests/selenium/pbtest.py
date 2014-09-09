#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import os
from glob import glob
from xvfbwrapper import Xvfb
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# PB_EXT_BG_URL_BASE = "chrome-extension://pkehgijcmpdhfbdbbnkijodmdjhbjlgp/"
PB_EXT_BG_URL_BASE = "chrome-extension://mcgekeccgjgcmhnhbabplanchdogjcnh/"
PB_CHROME_BG_URL = PB_EXT_BG_URL_BASE + "_generated_background_page.html"


class PBSeleniumTest(unittest.TestCase):
    def setUp(self):
        env = os.environ
        self.browser_bin = env.get("BROWSER_BIN", "")  # o/w use WD's default
        self.xvfb = int(env.get("ENABLE_XVFB", 1))  # enabled by default
        self.pb_ext_path = self.get_extension_path()  # path to the extension
        if self.xvfb:
            self.vdisplay = Xvfb(width=1280, height=720)
            self.vdisplay.start()
        self.driver = self.get_chrome_driver()
        self.driver.implicitly_wait(10)
        self.js = self.driver.execute_script

    def get_extension_path(self):
        """Return the path to the extension to be tested."""
        if "PB_EXT_PATH" in os.environ:
            return os.environ["PB_EXT_PATH"]
        else:  # check the default path if PB_EXT_PATH env. variable is empty
            print "Can't find the environment variable PB_EXT_PATH"
            # if the PB_EXT_PATH environment variable is not set
            # check the default location for the last modified crx file
            exts = glob("../../*.crx")  # get matching files
            return max(exts, key=os.path.getctime) if exts else ""

    def txt_by_css(self, css_selector):
        """Find an element by CSS selector and return it's text."""
        return self.driver.find_element_by_css_selector(css_selector).text

    def get_chrome_driver(self):
        """Setup and return a Chrom[e|ium] browser for Selenium."""
        opts = Options()
        absp = os.path.abspath
        if "TRAVIS" in os.environ:  # github.com/travis-ci/travis-ci/issues/938
            opts.add_argument("--no-sandbox")
        opts.add_extension(self.pb_ext_path)  # will fail if ext can't be found
        if self.browser_bin:  # otherwise will use webdriver's default binary
            print "Browser binary:", absp(self.browser_bin)
            opts.binary_location = self.browser_bin  # set binary location
        # Fix for https://code.google.com/p/chromedriver/issues/detail?id=799
        opts.add_experimental_option("excludeSwitches",
                                     ["ignore-certificate-errors"])
        return webdriver.Chrome(chrome_options=opts)

    def tearDown(self):
        self.driver.quit()
        if self.xvfb and self.vdisplay:
            self.vdisplay.stop()
