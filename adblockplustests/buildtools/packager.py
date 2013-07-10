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

# Note: These are the base functions common to all packagers, the actual
# packagers are implemented in packagerGecko and packagerChrome.

import sys, os, re, codecs, subprocess, json, zipfile, jinja2
from StringIO import StringIO
from chainedconfigparser import ChainedConfigParser

import buildtools

def getDefaultFileName(baseDir, metadata, version, ext):
  return os.path.join(baseDir, '%s-%s.%s' % (metadata.get('general', 'basename'), version, ext))

def getMetadataPath(baseDir, type):
  return os.path.join(baseDir, 'metadata.%s' % type)

def readMetadata(baseDir, type):
  return ChainedConfigParser(getMetadataPath(baseDir, type))

def getBuildNum(baseDir):
  try:
    result = subprocess.check_output(['hg', 'id', '-R', baseDir, '-n'])
    return re.sub(r'\D', '', result)
  except:
    return '0'

def getBuildVersion(baseDir, metadata, releaseBuild, buildNum=None):
  version = metadata.get('general', 'version')
  if not releaseBuild:
    if buildNum == None:
      buildNum = getBuildNum(baseDir)
    buildNum = str(buildNum)
    if len(buildNum) > 0:
      if re.search(r'(^|\.)\d+$', version):
        # Numerical version number - need to fill up with zeros to have three
        # version components.
        while version.count('.') < 2:
          version += '.0'
      version += '.' + buildNum
  return version

def getTemplate(template, autoEscape=False):
  templatePath = buildtools.__path__[0]
  if autoEscape:
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(templatePath), autoescape=True, extensions=['jinja2.ext.autoescape'])
  else:
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(templatePath))
  env.filters.update({'json': json.dumps})
  return env.get_template(template)

class Files(dict):
  def __init__(self, includedFiles, ignoredFiles, process=None):
    self.includedFiles = includedFiles
    self.ignoredFiles = ignoredFiles
    self.process = process

  def __setitem__(self, key, value):
    if self.process:
      value = self.process(key, value)
    dict.__setitem__(self, key, value)

  def isIncluded(self, relpath):
    parts = relpath.split('/')
    if not parts[0] in self.includedFiles:
      return False
    for part in parts:
      if part in self.ignoredFiles:
        return False
    return True

  def read(self, path, relpath='', skip=None):
    if os.path.isdir(path):
      for file in os.listdir(path):
        name = relpath + ('/' if relpath != '' else '') + file
        if (skip == None or file not in skip) and self.isIncluded(name):
          self.read(os.path.join(path, file), name)
    else:
      file = open(path, 'rb')
      if relpath in self:
        print >>sys.stderr, 'Warning: File %s defined multiple times' % relpath
      self[relpath] = file.read()
      file.close()

  def readMappedFiles(self, mappings):
    for item in mappings:
      target, source = item

      # Make sure the file is inside an included directory
      if '/' in target and not self.isIncluded(target):
        continue
      parts = source.split('/')
      path = os.path.join(os.path.dirname(item.source), *parts)
      if os.path.exists(path):
        self.read(path, target)
      else:
        print >>sys.stderr, 'Warning: Mapped file %s doesn\'t exist' % source

  def zip(self, outFile, sortKey=None):
    zip = zipfile.ZipFile(outFile, 'w', zipfile.ZIP_DEFLATED)
    names = self.keys()
    names.sort(key=sortKey)
    for name in names:
      zip.writestr(name, self[name])
    zip.close()

  def zipToString(self, sortKey=None):
    buffer = StringIO()
    self.zip(buffer, sortKey=sortKey)
    return buffer.getvalue()
