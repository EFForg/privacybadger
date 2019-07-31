import unittest
import pbtest

class pixelTrackingTesting(pbtest.PBSeleniumTest):
	"""Tests for the cookie pixel tracking heuristic included in heuristicblocking.js"""
	
	TESTING_URL = ("TODO:changethistowhateverthelinkendsupbeing")
	TRACKER_URL = ("TODO:whateverthisendsupbeing")

	def check_to_make_sure_tracker_is_caught():
		url = TESTING_URL
	
		self.load(url)

		self.assertEqual(
			self.js(
				"return (badger.storage.snitch_map.getItem("TODO:whateverthisisexpectedtobe"))"
			)
		)

if __name__ == "__main__":
	unittest.main()
