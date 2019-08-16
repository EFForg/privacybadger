#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import unittest
import pbtest

class pixelTrackingTesting(pbtest.PBSeleniumTest):
	"""Tests for the cookie pixel tracking heuristic included in heuristicblocking.js
		- loads gitcdn resource which places a tracking cookie on page then creates an img tag
		- img tag makes a src request carrying a substring of that tracking cookie
		- tracking domain is caught by pixel tracking heuristic, snitch map entry is updated
	"""

	def test_that_tracker_is_caught(self):
		TESTING_URL = ("https://gitcdn.link/repo/ablanathtanalba/pixelTrackingTestingResource/master/rsrc.html")

		CHECK_SNITCH_MAP_FOR_ENTRY = (
				"return chrome.extension.getBackgroundPage()."
				"badger.storage.snitch_map.getItem('github.com').includes('gitcdn.link');"
		)

		self.load_url(TESTING_URL)
		self.load_url(self.options_url)

		# github will already appear in a pretrained badger instance for appearing on fontawesome.com
		# instead check for it's specific appearance on gitcdn.link -- the testing resource for this
		self.assertTrue(
			self.js(CHECK_SNITCH_MAP_FOR_ENTRY)
		)

if __name__ == "__main__":
	unittest.main()
