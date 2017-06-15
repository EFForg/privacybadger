#!/usr/bin/env python
# -*- coding: UTF-8 -*-

###############################################################################
#
# A collection of helper functions to manage tabs. Driver is an instance of
# ChromeDriver.
#
###############################################################################

import time


def require_ext_apis(f):
    def wrapper(self, *args, **kwargs):
        if self.driver.current_url.startswith(self.base_url):
            return f(self, *args, **kwargs)
        raise ValueError('current url %s not a ext url %s' % (self.driver.current_url, self.base_url))
    return wrapper


def require_popup(f):
    def wrapper(self, *args, **kwargs):
        if self.driver.current_url.startswith(self.popup_url):
            return f(self, *args, **kwargs)
        raise ValueError('current url %s not a popup_url %s' % (self.driver.current_url, self.popup_url))
    return wrapper


class Tabs:
    def __init__(self, pbtest):
        self.driver = pbtest.driver
        self.base_url = pbtest.base_url
        self.bg_url = pbtest.bg_url
        self.popup_url = pbtest.popup_url

    def _goto_url(self, url):
        if self.driver.current_url == url:
            return
        u_to_h = self.get_url_to_handle_map()
        if url in u_to_h:
            self.driver.switch_to.window(u_to_h[url])
        else:
            if not self.driver.current_url.startswith(self.base_url):
                self.driver.get(url)
            else:
                before = set(self.driver.window_handles)
                self.new_tab(url)
                self.driver.switch_to.window((set(self.driver.window_handles) ^ before).pop())

    def goto_background(self):
        self._goto_url(self.bg_url)

    def goto_popup(self):
        self._goto_url(self.popup_url)

    @require_ext_apis
    def get_tab_id(self, origin):
        if origin.startswith('https://') or origin.startswith('http://'):
            origin = origin.split('/')[3]
        if '/' in origin:
            origin = origin.split('/')[0]
        get_tab_id_js = r'''/**
*/
let done = arguments[arguments.length - 1];
((origin)=>{
  chrome.tabs.query({url: "*://" + origin + "/*"}, (tabs) => {
    if (!tabs) {
      done();
    } else {
    done(tabs[0]);
    }
  });
})'''
        code = get_tab_id_js + ('("%s")' % origin)
        return self.driver.execute_async_script(code)

    @require_ext_apis
    def new_tab(self, url):
        '''create a new tab for the given url and return the id'''
        new_tab_js = r'''
((url, done) => {
  chrome.tabs.create({url: url}, (tab) => {
    done(tab.id);
  });
    }).apply(this, arguments);
'''
        code = new_tab_js
        return self.driver.execute_async_script(code, url)

    def remove_tab(self, tab_id):
        remove_tab_js = r'''/**
*/
let done = arguments[arguments.length - 1];
((tab_id)=>{
  chrome.tabs.remove(tab_id, () => {
    done();
  });
})'''
        code = remove_tab_js + ('(%s);' % tab_id)
        return self.driver.execute_async_script(code)

    @require_popup
    def refresh_popup(self, tab_id_or_origin):
        try:
            # given an int or int str
            tab_id = int(tab_id_or_origin)
        except ValueError as e:
            # given a url
            tab_id = self.get_tab_id(tab_id_or_origin)
            if not tab_id:
                # create a new tab since we don't have the url
                tab_id = self.new_tab(tab_id_or_origin)
        refresh_popup_js = r'''/**
*/
let done = arguments[arguments.length - 1];
((tab_id)=>{
  refreshPopup(tab_id, done);
})'''
        code = refresh_popup_js + ('(%s);' % tab_id)
        return self.driver.execute_async_script(code)

    def get_url_to_handle_map(self):
        out = {}
        before = self.driver.current_window_handle
        for w in self.driver.window_handles:
            self.driver.switch_to.window(w)
            out[self.driver.current_url] = self.driver.current_window_handle
        self.driver.switch_to.window(before)
        return out


def switch_to_window_with_url(driver, url, max_tries=20):
    """Point the driver to the first window that matches this url."""
    for _ in range(max_tries):
        windows = get_windows_with_url(driver, url)
        if len(windows) > 0:
            # if multiple tabs point at this url, switch to the first one
            driver.switch_to.window(windows[0])
            return
        time.sleep(1)
    raise Exception("was not able to find window for url " + url)


def refresh_window_with_url(driver, url, max_tries=20):
    """Have the driver redresh the first window that matches this url"""
    for _ in range(max_tries):
        windows = get_windows_with_url(driver, url)
        if len(windows) > 0:
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
        if len(windows) > 0:
            [close_window(driver, w) for w in windows]
            if len(driver.window_handles) > 0:
                driver.switch_to.window(driver.window_handles[0])
            return
        time.sleep(1)
    raise Exception("was not able to find window for url " + url)


def get_windows_with_url(driver, url):
    """Get a list of existing windows that match the url."""
    windows = []
    for w in driver.window_handles:
        driver.switch_to.window(w)
        if driver.current_window_handle != w:
            # driver.current_window_handle
            raise Exception("window handles don't match!")
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
