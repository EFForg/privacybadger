# coding: utf-8

# This file is part of the Adblock Plus build tools,
# Copyright (C) 2006-2013 Eyeo GmbH
#
# Adblock Plus is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation.
#
# Adblock Plus is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.

"""
Update the public suffix list
==============================

  This script generates a js array of public suffixes (http://publicsuffix.org/)
"""

import os
import urllib
import json

def urlopen(url, attempts=3):
  """
  Tries to open a particular URL, retries on failure.
  """
  for i in range(attempts):
    try:
      return urllib.urlopen(url)
    except IOError, e:
      error = e
      time.sleep(5)
  raise error

def getPublicSuffixList():
  """
  gets download link for a Gecko add-on from the Mozilla Addons site
  """
  suffixes = {};
  url = 'http://mxr.mozilla.org/mozilla-central/source/netwerk/dns/effective_tld_names.dat?raw=1'
  resource = urlopen(url)

  for line in resource:
    line = line.rstrip()
    if line.startswith("//") or "." not in line:
      continue
    if line.startswith('*.'):
      suffixes[line[2:]] = 2
    elif line.startswith('!'):
      suffixes[line[1:]] = 0
    else:
      suffixes[line] = 1

  return suffixes

def updatePSL(baseDir):
  """
  writes the current public suffix list to js file in json format
  """

  psl = getPublicSuffixList()
  file = open(os.path.join(baseDir, 'lib', 'publicSuffixList.js'), 'w')
  print >>file, 'var publicSuffixes = ' + json.dumps(psl, sort_keys=True, indent=4, separators=(',', ': ')) + ';'
  file.close()
