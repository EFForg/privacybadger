# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import sys, os, urllib, zipfile
from StringIO import StringIO

def ensureJSShell():
  baseDir = os.path.dirname(__file__)
  shell_dir = os.path.join(baseDir, 'mozilla')
  if not os.path.exists(shell_dir):
    os.makedirs(shell_dir)
  if sys.platform == 'win32':
    path = os.path.join(shell_dir, 'js.exe')
  else:
    path = os.path.join(shell_dir, 'js')
  if os.path.exists(path):
    return path

  platform_map = {
    'win32': 'win32',
    'linux2': 'linux-i686',
    'darwin': 'mac',
  }
  if sys.platform not in platform_map:
    raise Exception('Unknown platform, is there a JS shell version for it?')

  download_url = 'https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/20.0-candidates/build1/jsshell-%s.zip' % platform_map[sys.platform]
  data = StringIO(urllib.urlopen(download_url).read())
  zip = zipfile.ZipFile(data)
  zip.extractall(shell_dir)
  zip.close()

  if not os.path.exists(path):
    raise Exception('Downloaded package didn\'t contain JS shell executable')

  try:
    os.chmod(path, 0700)
  except:
    pass

  return path
