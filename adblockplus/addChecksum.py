#!/usr/bin/env python
# coding: utf-8

# This file is part of Adblock Plus <http://adblockplus.org/>,
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

#############################################################################
# This is a reference script to add checksums to downloadable               #
# subscriptions. The checksum will be validated by Adblock Plus on download #
# and checksum mismatches (broken downloads) will be rejected.              #
#                                                                           #
# To add a checksum to a subscription file, run the script like this:       #
#                                                                           #
#   python addChecksum.py < subscription.txt > subscriptionSigned.txt       #
#                                                                           #
# Note: your subscription file should be saved in UTF-8 encoding, otherwise #
# the operation will fail.                                                  #
#                                                                           #
#############################################################################

import sys, re, codecs, hashlib, base64

checksumRegexp = re.compile(r'^\s*!\s*checksum[\s\-:]+([\w\+\/=]+).*\n', re.I | re.M)

def addChecksum(data):
  checksum = calculateChecksum(data)
  data = re.sub(checksumRegexp, '', data)
  data = re.sub(r'(\r?\n)', r'\1! Checksum: %s\1' % checksum, data, 1)
  return data

def calculateChecksum(data):
  md5 = hashlib.md5()
  md5.update(normalize(data).encode('utf-8'))
  return base64.b64encode(md5.digest()).rstrip('=')

def normalize(data):
  data = re.sub(r'\r', '', data)
  data = re.sub(r'\n+', '\n', data)
  data = re.sub(checksumRegexp, '', data)
  return data

def readStream(stream):
  reader = codecs.getreader('utf8')(stream)
  try:
    return reader.read()
  except Exception, e:
    raise Exception('Failed reading data, most likely not encoded as UTF-8:\n%s' % e)

if __name__ == '__main__':
  if sys.platform == "win32":
    import os, msvcrt
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

  data = addChecksum(readStream(sys.stdin))
  sys.stdout.write(data.encode('utf-8'))
