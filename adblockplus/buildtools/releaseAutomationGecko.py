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

import os, re, subprocess, tarfile
from StringIO import StringIO
import buildtools.packagerGecko as packager

def run(baseDir, version, keyFile, downloadsRepo):
  # Replace version number in metadata file "manually", ConfigParser will mess
  # up the order of lines.
  handle = open(packager.getMetadataPath(baseDir), 'rb')
  rawMetadata = handle.read()
  handle.close()
  versionRegExp = re.compile(r'^(\s*version\s*=\s*).*', re.I | re.M)
  rawMetadata = re.sub(versionRegExp, r'\g<1>%s' % version, rawMetadata)
  handle = open(packager.getMetadataPath(baseDir), 'wb')
  handle.write(rawMetadata)
  handle.close()

  # Read extension name and branch name
  locales = packager.readLocaleMetadata(baseDir, [packager.defaultLocale])
  extensionName = locales[packager.defaultLocale]['name']

  metadata = packager.readMetadata(baseDir)

  # Now commit the change and tag it
  subprocess.check_call(['hg', 'commit', '-R', baseDir, '-m', 'Releasing %s %s' % (extensionName, version)])
  subprocess.check_call(['hg', 'tag', '-R', baseDir, '-f', version])

  # Create a release build
  buildPath = os.path.join(downloadsRepo, packager.getDefaultFileName(baseDir, metadata, version, 'xpi'))
  packager.createBuild(baseDir, outFile=buildPath, releaseBuild=True, keyFile=keyFile)

  # Create source archive
  archivePath = os.path.splitext(buildPath)[0] + '-source.tgz'

  archiveHandle = open(archivePath, 'wb')
  archive = tarfile.open(fileobj=archiveHandle, name=os.path.basename(archivePath), mode='w:gz')
  data = subprocess.check_output(['hg', 'archive', '-R', baseDir, '-t', 'tar', '-S', '-'])
  repoArchive = tarfile.open(fileobj=StringIO(data), mode='r:')
  for fileInfo in repoArchive:
    if os.path.basename(fileInfo.name) in ('.hgtags', '.hgignore'):
      continue
    fileData = repoArchive.extractfile(fileInfo)
    fileInfo.name = re.sub(r'^[^/]+/', '', fileInfo.name)
    archive.addfile(fileInfo, fileData)
  repoArchive.close()
  archive.close()
  archiveHandle.close()

  # Now add the downloads and commit
  subprocess.check_call(['hg', 'add', '-R', downloadsRepo, buildPath, archivePath])
  subprocess.check_call(['hg', 'commit', '-R', downloadsRepo, '-m', 'Releasing %s %s' % (extensionName, version)])

  # Push all changes
  subprocess.check_call(['hg', 'push', '-R', baseDir])
  subprocess.check_call(['hg', 'push', '-R', downloadsRepo])
