#!/usr/bin/env python
# -*- coding: UTF-8 -*-

#######################################################################################
#
# A collection of helper functions to manage tabs. Driver is an instance of
# ChromeDriver.
#
#######################################################################################

import time

def switch_to_window_with_url( driver, url, max_tries=20 ):
	"""Point the driver to the first window that matches this url."""
	for i in range( max_tries ):
		#print "switch to window with url " + url + " try number " + str(i)
		windows = get_windows_with_url( driver, url )
		if len(windows) > 0:
			# if multiple tabs point at this url, switch to the first one
			driver.switch_to.window( windows[0] )
			return
		time.sleep(1)
	raise Exception("was not able to find window for url " + url )

def refresh_window_with_url( driver, url, max_tries=20 ):
	"""Have the driver redresh the first window that matches this url"""
	for i in range( max_tries ):
		#print "switch to window with url " + url + " try number " + str(i)
		windows = get_windows_with_url( driver, url )
		if len(windows) > 0:
			# if multiple tabs point at this url, refresh to the first one
			driver.switch_to.window( windows[0] )
			driver.refresh()
			return
		time.sleep(1)
	raise Exception("was not able to find window for url " + url )


def close_windows_with_url(driver, url, max_tries=20 ):
	"""Find all the tabs with the given url and close them. Note: if there are no 
	more windows left this will close the browser too."""
	for i in range( max_tries ):
		#print "close windows with url " + url + " try number " + str(i)
		windows = get_windows_with_url( driver, url )
		if len(windows) > 0:
			#print "closing " + str(len(windows)) + " windows "
			[close_window(driver,w) for w in windows]
			if len( driver.window_handles ) > 0:
				driver.switch_to.window( driver.window_handles[0] )
			return
		time.sleep(1)
	raise Exception("was not able to find window for url " + url )

def get_windows_with_url( driver, url ):
	"""Get a list of existing windows that match the url."""
	windows = []
	for w in driver.window_handles:
		driver.switch_to.window( w )
		if driver.current_window_handle != w:
			#print "target window " + w + " current window " + driver.current_window_handle
			raise Exception("window handles don't match!")
		# current_url might have a trailing slash on it, so try it both ways
		alt_url = url
		if alt_url[-1] != '/': alt_url += '/'
		#print "\tget_windows_with_url " + url + ": looking at " + driver.current_url
		if driver.current_url == url or driver.current_url == alt_url:
			#print "\tfound a match"
			windows.append( w )
	return windows

def close_window( driver, w ):
	"""Close the window associated with the given window handle."""
	driver.switch_to.window(w)
	return driver.close()
