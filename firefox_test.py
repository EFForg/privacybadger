#!/usr/bin/env python
from contextlib import contextmanager
import time
import subprocess

from selenium.webdriver import DesiredCapabilities
from selenium import webdriver

@contextmanager
def get_driver():
    cmd = ['./firefox_selenium.sh']
    proc = subprocess.Popen(cmd)
    time.sleep(0.5)

    ffcaps = DesiredCapabilities.FIREFOX
    driver = webdriver.Remote('http://127.0.0.1:4444', ffcaps)
    try:
        yield driver
    finally:
        proc.terminate()

with get_driver() as driver:
    driver.quit()
