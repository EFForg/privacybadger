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


def refresh_window_with_url(driver, url, max_tries=20):
    """Have the driver redresh the first window that matches this url"""
    for _ in range(max_tries):
        windows = get_windows_with_url(driver, url)
        if windows:
            # if multiple tabs point at this url, refresh to the first one
            driver.switch_to.window(windows[0])
            driver.refresh()
            return
        time.sleep(1)
    raise Exception("was not able to find window for url " + url)


def close_windows_with_url(driver, url, max_tries=20):
    """Find all the tabs with the given url and close them. Note: if there
    are no more windows left this will close the browser too."""
    for _ in range(max_tries):
        windows = get_windows_with_url(driver, url)
        if windows:
            for w in windows:
                close_window(driver, w)
            if driver.window_handles:
                driver.switch_to.window(driver.window_handles[0])
            return
        time.sleep(1)
    raise Exception("was not able to find window for url " + url)


def get_windows_with_url(driver, url):
    """Get a list of existing windows that match the url."""
    windows = []
    for w in driver.window_handles:
        driver.switch_to.window(w)
        # current_url might have a trailing slash on it, so try it both ways
        alt_url = url
        if alt_url[-1] != '/':
            alt_url += '/'
        # driver.current_url
        if driver.current_url == url or driver.current_url == alt_url:
            windows.append(w)
    return windows


def close_window(driver, w):
    """Close the window associated with the given window handle."""
    driver.switch_to.window(w)
    return driver.close()
