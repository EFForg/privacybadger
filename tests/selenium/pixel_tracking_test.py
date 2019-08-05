import unittest
import pbtest

class pixelTrackingTesting(pbtest.PBSeleniumTest):
	"""Tests for the cookie pixel tracking heuristic included in heuristicblocking.js"""
	
	TESTING_URL = ("https://gitcdn.link/repo/ablanathtanalba/pixelTrackingTestingResource/master/main.js")

	def check_to_make_sure_tracker_is_caught():
		url = TESTING_URL
	
		self.load(url)

		self.assertEqual(
			self.js(
				"return (badger.storage.snitch_map.getItem(url))"
			)
		)

if __name__ == "__main__":
	unittest.main()
