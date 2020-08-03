#!/usr/bin/env python
# -*- coding: UTF-8 -*-

###############################################################################
#
# A collection of helper functions to manage tabs. Driver is an instance of
# ChromeDriver.
#
###############################################################################

import time

from selenium.common.exceptions import NoSuchWindowException


class WindowNotFoundException(Exception):
    pass


def switch_to_window_with_url(driver, url, max_tries=5):
    """Point the driver to the first window that matches this url."""

    for _ in range(max_tries):
        for w in driver.window_handles:
            try:
                driver.switch_to.window(w)
                if driver.current_url != url:
                    continue
            except NoSuchWindowException:
                pass
            else:
                return

        time.sleep(1)

    raise WindowNotFoundException("Failed to find window for " + url)


def close_window_with_url(driver, url):
    switch_to_window_with_url(driver, url)
    driver.close()
    if driver.window_handles:
        driver.switch_to.window(driver.window_handles[0])
