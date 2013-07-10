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

import os, sys, re, hashlib, base64, urllib, json
from ConfigParser import SafeConfigParser
from StringIO import StringIO
import xml.dom.minidom as minidom
import buildtools.localeTools as localeTools

import packager
from packager import readMetadata, getMetadataPath, getDefaultFileName, getBuildVersion, getTemplate, Files

KNOWN_APPS = {
  'conkeror':   '{a79fe89b-6662-4ff4-8e88-09950ad4dfde}',
  'emusic':     'dlm@emusic.com',
  'fennec':     '{a23983c0-fd0e-11dc-95ff-0800200c9a66}',
  'fennec2':    '{aa3c5121-dab2-40e2-81ca-7ea25febc110}',
  'firefox':    '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}',
  'midbrowser': '{aa5ca914-c309-495d-91cf-3141bbb04115}',
  'prism':      'prism@developer.mozilla.org',
  'seamonkey':  '{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}',
  'songbird':   'songbird@songbirdnest.com',
  'thunderbird':  '{3550f703-e582-4d05-9a08-453d09bdfdc6}',
  'toolkit':    'toolkit@mozilla.org',
}

defaultLocale = 'en-US'

def getChromeDir(baseDir):
  return os.path.join(baseDir, 'chrome')

def getLocalesDir(baseDir):
  return os.path.join(getChromeDir(baseDir), 'locale')

def getChromeSubdirs(baseDir, locales):
  result = {}
  chromeDir = getChromeDir(baseDir)
  for subdir in ('content', 'skin'):
    result[subdir] = os.path.join(chromeDir, subdir)
  for locale in locales:
    result['locale/%s' % locale] = os.path.join(chromeDir, 'locale', locale)
  return result

def getPackageFiles(params):
  result = set(('chrome', 'components', 'modules', 'lib', 'resources', 'defaults', 'chrome.manifest', 'icon.png', 'icon64.png',))

  baseDir = params['baseDir']
  for file in os.listdir(baseDir):
    if file.endswith('.js') or file.endswith('.xml'):
      result.add(file)
  return result

def getIgnoredFiles(params):
  result = set(('.incomplete', 'meta.properties',))
  if params['releaseBuild']:
    result.add('timeline.js')
  return result

def isValidLocale(localesDir, dir, includeIncomplete=False):
  if re.search(r'[^\w\-]', dir):
    return False
  if not os.path.isdir(os.path.join(localesDir, dir)):
    return False
  if not includeIncomplete and os.path.exists(os.path.join(localesDir, dir, '.incomplete')):
    return False
  return True

def getLocales(baseDir, includeIncomplete=False):
  global defaultLocale
  localesDir = getLocalesDir(baseDir)
  locales = filter(lambda dir:  isValidLocale(localesDir, dir, includeIncomplete), os.listdir(localesDir))
  locales.sort(key=lambda x: '!' if x == defaultLocale else x)
  return locales

def processFile(path, data, params):
  if path.endswith('.manifest') and data.find('{{LOCALE}}') >= 0:
    localesRegExp = re.compile(r'^(.*?){{LOCALE}}(.*?){{LOCALE}}(.*)$', re.M)
    replacement = '\n'.join(map(lambda locale: r'\1%s\2%s\3' % (locale, locale), params['locales']))
    data = re.sub(localesRegExp, replacement, data)

  if params['releaseBuild'] and path.endswith('.js'):
    # Remove timeline calls from release builds
    timelineRegExp1 = re.compile(r'^.*\b[tT]imeLine\.(\w+)\(.*', re.M)
    timelineRegExp2 = re.compile(r'^.*\brequire\(\"timeline\"\).*', re.M)
    data = re.sub(timelineRegExp1, '', data)
    data = re.sub(timelineRegExp2, '', data)

  return data

def readLocaleMetadata(baseDir, locales):
  result = {}

  # Make sure we always have fallback data even if the default locale isn't part
  # of the build
  locales = list(locales)
  if not defaultLocale in locales:
    locales.append(defaultLocale)

  for locale in locales:
    data = SafeConfigParser()
    data.optionxform = str
    try:
      result[locale] = localeTools.readFile(os.path.join(getLocalesDir(baseDir), locale, 'meta.properties'))
    except:
      result[locale] = {}
  return result

def getContributors(metadata):
  main = []
  additional = set()
  if metadata.has_section('contributors'):
    options = metadata.options('contributors')
    options.sort()
    for option in options:
      value = metadata.get('contributors', option)
      if re.search(r'\D', option):
        match = re.search(r'^\s*(\S+)\s+//([^/\s]+)/@(\S+)\s*$', value)
        if not match:
          print >>sys.stderr, 'Warning: unrecognized contributor location "%s"\n' % value
          continue
        baseDir = os.path.dirname(metadata.option_source('contributors', option))
        parts = match.group(1).split('/')
        dom = minidom.parse(os.path.join(baseDir, *parts))
        tags = dom.getElementsByTagName(match.group(2))
        for tag in tags:
          if tag.hasAttribute(match.group(3)):
            for name in re.split(r'\s*,\s*', tag.getAttribute(match.group(3))):
              additional.add(name)
      else:
        main.append(value)
  return main + sorted(additional, key=unicode.lower)

def initTranslators(localeMetadata):
  for locale in localeMetadata.itervalues():
    if 'translator' in locale:
      locale['translators'] = sorted(map(lambda t: t.strip(), locale['translator'].split(',')), key=unicode.lower)
    else:
      locale['translators'] = []

def createManifest(params):
  global KNOWN_APPS, defaultLocale
  template = getTemplate('install.rdf.tmpl', autoEscape=True)
  templateData = dict(params)
  templateData['localeMetadata'] = readLocaleMetadata(params['baseDir'], params['locales'])
  initTranslators(templateData['localeMetadata'])
  templateData['KNOWN_APPS'] = KNOWN_APPS
  templateData['defaultLocale'] = defaultLocale
  return template.render(templateData).encode('utf-8')

def fixupLocales(params, files):
  global defaultLocale

  # Read in default locale data, it might not be included in files
  defaultLocaleDir = os.path.join(getLocalesDir(params['baseDir']), defaultLocale)
  reference = {}
  ignoredFiles = getIgnoredFiles(params)
  for file in os.listdir(defaultLocaleDir):
    path = os.path.join(defaultLocaleDir, file)
    if file in ignoredFiles or not os.path.isfile(path):
      continue
    data = localeTools.readFile(path)
    if data:
      reference[file] = data

  for locale in params['locales']:
    for file in reference.iterkeys():
      path = 'chrome/locale/%s/%s' % (locale, file)
      if path in files:
        data = localeTools.parseString(files[path].decode('utf-8'), path)
        for key, value in reference[file].iteritems():
          if not key in data:
            files[path] += localeTools.generateStringEntry(key, value, path).encode('utf-8')
      else:
        files[path] = reference[file]['_origData'].encode('utf-8')

def addMissingFiles(params, files):
  templateData = {
    'hasChrome': False,
    'hasChromeRequires': False,
    'hasShutdownHandlers': False,
    'hasVersionPref': False,
    'chromeWindows': [],
    'requires': {},
    'metadata': params['metadata'],
    'multicompartment': params['multicompartment'],
    'applications': dict((v, k) for k, v in KNOWN_APPS.iteritems()),
  }

  def checkScript(name):
    content = files[name]
    for match in re.finditer(r'(?:^|\s)require\(\s*"([\w\-]+)"\s*\)', content):
      templateData['requires'][match.group(1)] = True
      if name.startswith('chrome/content/'):
        templateData['hasChromeRequires'] = True
    if name == 'defaults/prefs.js':
      if re.search(r'\.currentVersion"', content):
        templateData['hasVersionPref'] = True
    if not '/' in name or name.startswith('lib/'):
      if re.search(r'(?:^|\s)onShutdown\.', content):
        templateData['hasShutdownHandlers'] = True

  for name, content in files.iteritems():
    if name == 'chrome.manifest':
      templateData['hasChrome'] = True
    elif name.endswith('.js'):
      checkScript(name)
    elif name.endswith('.xul'):
      match = re.search(r'<(?:window|dialog)\s[^>]*\bwindowtype="([^">]+)"', content)
      if match:
        templateData['chromeWindows'].append(match.group(1))

  while True:
    missing = []
    for module in templateData['requires']:
      moduleFile = 'lib/' + module + '.js'
      if not moduleFile in files:
        import buildtools
        path = os.path.join(buildtools.__path__[0], moduleFile)
        if os.path.exists(path):
          missing.append((path, moduleFile))
    if not len(missing):
      break
    for path, moduleFile in missing:
      files.read(path, moduleFile)
      checkScript(moduleFile)

  template = getTemplate('bootstrap.js.tmpl')
  files['bootstrap.js'] = template.render(templateData).encode('utf-8')

def signFiles(files, keyFile):
  import M2Crypto
  manifest = []
  signature = []

  def getDigest(data):
    md5 = hashlib.md5()
    md5.update(data)
    sha1 = hashlib.sha1()
    sha1.update(data)
    return 'Digest-Algorithms: MD5 SHA1\nMD5-Digest: %s\nSHA1-Digest: %s\n' % (base64.b64encode(md5.digest()), base64.b64encode(sha1.digest()))

  def addSection(manifestData, signaturePrefix):
    manifest.append(manifestData)
    signatureData = ''
    if signaturePrefix:
      signatureData += signaturePrefix
    signatureData += getDigest(manifestData)
    signature.append(signatureData)

  addSection('Manifest-Version: 1.0\n', 'Signature-Version: 1.0\n')
  fileNames = files.keys()
  fileNames.sort()
  for fileName in fileNames:
    addSection('Name: %s\n%s' % (fileName, getDigest(files[fileName])), 'Name: %s\n' % fileName)
  files['META-INF/manifest.mf'] = '\n'.join(manifest)
  files['META-INF/zigbert.sf'] = '\n'.join(signature)

  keyHandle = open(keyFile, 'rb')
  keyData = keyHandle.read()
  keyHandle.close()
  stack = M2Crypto.X509.X509_Stack()
  first = True
  for match in re.finditer(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----', keyData, re.S):
    if first:
      # Skip first certificate
      first = False
    else:
      stack.push(M2Crypto.X509.load_cert_string(match.group(0)))

  mime = M2Crypto.SMIME.SMIME()
  mime.load_key(keyFile)
  mime.set_x509_stack(stack)
  signature = mime.sign(M2Crypto.BIO.MemoryBuffer(files['META-INF/zigbert.sf'].encode('utf-8')), M2Crypto.SMIME.PKCS7_DETACHED | M2Crypto.SMIME.PKCS7_BINARY)

  buffer = M2Crypto.BIO.MemoryBuffer()
  signature.write_der(buffer)
  files['META-INF/zigbert.rsa'] = buffer.read()

def createBuild(baseDir, type="gecko", outFile=None, locales=None, buildNum=None, releaseBuild=False, keyFile=None, multicompartment=False):
  if locales == None:
    locales = getLocales(baseDir)
  elif locales == 'all':
    locales = getLocales(baseDir, True)

  metadata = readMetadata(baseDir, type)
  version = getBuildVersion(baseDir, metadata, releaseBuild, buildNum)

  if outFile == None:
    outFile = getDefaultFileName(baseDir, metadata, version, 'xpi')

  contributors = getContributors(metadata)

  params = {
    'baseDir': baseDir,
    'locales': locales,
    'releaseBuild': releaseBuild,
    'version': version.encode('utf-8'),
    'metadata': metadata,
    'contributors': contributors,
    'multicompartment': multicompartment,
  }

  files = Files(getPackageFiles(params), getIgnoredFiles(params),
                process=lambda path, data: processFile(path, data, params))
  files['install.rdf'] = createManifest(params)
  if metadata.has_section('mapping'):
    files.readMappedFiles(metadata.items('mapping'))
  files.read(baseDir, skip=('chrome'))
  for name, path in getChromeSubdirs(baseDir, params['locales']).iteritems():
    if os.path.isdir(path):
      files.read(path, 'chrome/%s' % name)
  fixupLocales(params, files)
  if not 'bootstrap.js' in files:
    addMissingFiles(params, files)
  if keyFile:
    signFiles(files, keyFile)
  files.zip(outFile, sortKey=lambda x: '!' if x == 'META-INF/zigbert.rsa' else x)

def autoInstall(baseDir, type, host, port, multicompartment=False):
  fileBuffer = StringIO()
  createBuild(baseDir, type=type, outFile=fileBuffer, multicompartment=multicompartment)
  urllib.urlopen('http://%s:%s/' % (host, port), data=fileBuffer.getvalue())
