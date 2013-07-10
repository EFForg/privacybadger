#!/usr/bin/env python
# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import sys, os, subprocess, utils

def doRewrite(files, args):
  application = utils.ensureJSShell()

  env = {
    'LD_LIBRARY_PATH': os.path.relpath(os.path.dirname(application)),
  }

  baseDir = os.path.dirname(utils.__file__)
  command = [
    application, os.path.join(baseDir, 'jshydra.js'),
    os.path.join(baseDir, 'scripts', 'abprewrite.js'),
    '--arg', ' '.join(args)
  ] + files
  return subprocess.check_output(command, env=env).replace('\r', '')

if __name__ == '__main__':
  try:
    scriptArgsStart = sys.argv.index('--arg')
  except ValueError:
    scriptArgsStart = len(sys.argv)
  print doRewrite(sys.argv[1:scriptArgsStart], sys.argv[scriptArgsStart + 1:])
