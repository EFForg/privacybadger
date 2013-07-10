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

import sys, os, re, json, struct
from StringIO import StringIO

import packager
from packager import readMetadata, getMetadataPath, getDefaultFileName, getBuildVersion, getTemplate, Files

defaultLocale = 'en_US'

def getIgnoredFiles(params):
  result = set(('store.description',))

  # Hack: ignore all lib subdirectories
  libDir = os.path.join(params['baseDir'], 'lib')
  for file in os.listdir(libDir):
    if os.path.isdir(os.path.join(libDir, file)):
      result.add(file)
  return result

def getPackageFiles(params):
  result = set(('_locales', 'icons', 'jquery-ui', 'lib', 'skin', 'ui',))

  if params['devenv']:
    result.add('qunit')

  baseDir = params['baseDir']
  for file in os.listdir(baseDir):
    if file.endswith('.js') or file.endswith('.html') or file.endswith('.xml'):
      result.add(file)
  return result

def processFile(path, data, params):
  # We don't change anything yet, this function currently only exists here so
  # that it can be overridden if necessary.
  return data

def createManifest(params):
  template = getTemplate('manifest.json.tmpl')
  templateData = dict(params)

  baseDir = templateData['baseDir']
  metadata = templateData['metadata']

  if metadata.has_option('general', 'pageAction') and metadata.get('general', 'pageAction') != '':
    if re.search(r'\s+', metadata.get('general', 'pageAction')):
      icon, popup = re.split(r'\s+', metadata.get('general', 'pageAction'), 1)
    else:
      icon, popup = (metadata.get('general', 'pageAction'), None)
    templateData['pageAction'] = {'icon': icon, 'popup': popup}

  if metadata.has_option('general', 'browserAction') and metadata.get('general', 'browserAction') != '':
    if re.search(r'\s+', metadata.get('general', 'browserAction')):
      icon, popup = re.split(r'\s+', metadata.get('general', 'browserAction'), 1)
    else:
      icon, popup = (metadata.get('general', 'browserAction'), None)
    templateData['browserAction'] = {'icon': icon, 'popup': popup}

  if metadata.has_option('general', 'icons'):
    icons = {}
    iconsDir = baseDir
    for dir in metadata.get('general', 'icons').split('/')[0:-1]:
      iconsDir = os.path.join(iconsDir, dir)

    prefix, suffix = metadata.get('general', 'icons').split('/')[-1].split('?', 1)
    for file in os.listdir(iconsDir):
      path = os.path.join(iconsDir, file)
      if os.path.isfile(path) and file.startswith(prefix) and file.endswith(suffix):
        size = file[len(prefix):-len(suffix)]
        if not re.search(r'\D', size):
          icons[size] = os.path.relpath(path, baseDir).replace('\\', '/')

    templateData['icons'] = icons

  if metadata.has_option('general', 'permissions'):
    templateData['permissions'] = re.split(r'\s+', metadata.get('general', 'permissions'))
    if params['experimentalAPI']:
      templateData['permissions'].append('experimental')

  if metadata.has_option('general', 'backgroundScripts'):
    templateData['backgroundScripts'] = re.split(r'\s+', metadata.get('general', 'backgroundScripts'))
    if params['devenv']:
      templateData['backgroundScripts'].append('devenvPoller__.js')

  if metadata.has_option('general', 'webAccessible') and metadata.get('general', 'webAccessible') != '':
    templateData['webAccessible'] = re.split(r'\s+', metadata.get('general', 'webAccessible'))

  if metadata.has_section('contentScripts'):
    contentScripts = []
    for run_at, scripts in metadata.items('contentScripts'):
      if scripts == '':
        continue
      contentScripts.append({
        'matches': ['http://*/*', 'https://*/*'],
        'js': re.split(r'\s+', scripts),
        'run_at': run_at,
        'all_frames': True,
      })
    templateData['contentScripts'] = contentScripts

  manifest = template.render(templateData)

  # Normalize JSON structure
  licenseComment = re.compile(r'/\*.*?\*/', re.S)
  data = json.loads(re.sub(licenseComment, '', manifest, 1))
  if '_dummy' in data:
    del data['_dummy']
  manifest = json.dumps(data, sort_keys=True, indent=2)

  return manifest.encode('utf-8')

def createPoller(params):
  template = getTemplate('chromeDevenvPoller__.js.tmpl')
  return template.render(params).encode('utf-8');

def convertJS(params, files):
  from jshydra.abp_rewrite import doRewrite

  for item in params['metadata'].items('convert_js'):
    file, sources = item
    baseDir = os.path.dirname(item.source)

    # Make sure the file is inside an included directory
    if '/' in file and not files.isIncluded(file):
      continue

    sourceFiles = re.split(r'\s+', sources)
    args = []
    try:
      argsStart = sourceFiles.index('--arg')
      args = sourceFiles[argsStart + 1:]
      sourceFiles = sourceFiles[0:argsStart]
    except ValueError:
      pass

    # Source files of the conversion shouldn't be part of the build
    for sourceFile in sourceFiles:
      if sourceFile in files:
        del files[sourceFile]

    sourceFiles = map(lambda f: os.path.abspath(os.path.join(baseDir, f)), sourceFiles)
    files[file] = doRewrite(sourceFiles, args)

def importGeckoLocales(params, files):
  import localeTools

  localeCodeMapping = {
    'ar': 'ar',
    'bg': 'bg',
    'ca': 'ca',
    'cs': 'cs',
    'da': 'da',
    'de': 'de',
    'el': 'el',
    'en-US': 'en_US',
    'en-GB': 'en_GB',
    'es-ES': 'es',
    'es-AR': 'es_419',
    'et': 'et',
    'fi': 'fi',
  #   '': 'fil', ???
    'fr': 'fr',
    'he': 'he',
    'hi-IN': 'hi',
    'hr': 'hr',
    'hu': 'hu',
    'id': 'id',
    'it': 'it',
    'ja': 'ja',
    'ko': 'ko',
    'lt': 'lt',
    'lv': 'lv',
    'nl': 'nl',
  #    'nb-NO': 'no', ???
    'pl': 'pl',
    'pt-BR': 'pt_BR',
    'pt-PT': 'pt_PT',
    'ro': 'ro',
    'ru': 'ru',
    'sk': 'sk',
    'sl': 'sl',
    'sr': 'sr',
    'sv-SE': 'sv',
    'th': 'th',
    'tr': 'tr',
    'uk': 'uk',
    'vi': 'vi',
    'zh-CN': 'zh_CN',
    'zh-TW': 'zh_TW',
  }

  for source, target in localeCodeMapping.iteritems():
    targetFile = '_locales/%s/messages.json' % target

    for item in params['metadata'].items('import_locales'):
      fileName, keys = item
      parts = map(lambda n: source if n == '*' else n, fileName.split('/'))
      sourceFile = os.path.join(os.path.dirname(item.source), *parts)
      incompleteMarker = os.path.join(os.path.dirname(sourceFile), '.incomplete')
      if not os.path.exists(sourceFile) or os.path.exists(incompleteMarker):
        continue

      data = {}
      if targetFile in files:
        data = json.loads(files[targetFile].decode('utf-8'))

      try:
        sourceData = localeTools.readFile(sourceFile)

        # Resolve wildcard imports
        if keys == '*' or keys == '=*':
          importList = sourceData.keys()
          importList = filter(lambda k: not k.startswith('_'), importList)
          if keys == '=*':
            importList = map(lambda k: '=' + k, importList)
          keys = ' '.join(importList)

        for stringID in re.split(r'\s+', keys):
          noMangling = False
          if stringID.startswith('='):
            stringID = stringID[1:]
            noMangling = True

          if stringID in sourceData:
            if noMangling:
              key = re.sub(r'\W', '_', stringID)
            else:
              key = re.sub(r'\..*', '', parts[-1]) + '_' + re.sub(r'\W', '_', stringID)
            if key in data:
              print 'Warning: locale string %s defined multiple times' % key

            # Remove access keys
            value = sourceData[stringID]
            match = re.search(r'^(.*?)\s*\(&.\)$', value)
            if match:
              value = match.group(1)
            else:
              index = value.find("&")
              if index >= 0:
                value = value[0:index] + value[index + 1:]
            data[key] = {'message': value}
      except Exception, e:
        print 'Warning: error importing locale data from %s: %s' % (sourceFile, e)

      files[targetFile] = json.dumps(data, ensure_ascii=False, sort_keys=True,
                            indent=2, separators=(',', ': ')).encode('utf-8') + '\n'

  if params['type'] == 'opera':
    # Opera has a slightly different locale mapping
    operaMapping = {
      'es': 'es_ES',
      'es_419': None,
      'pt': 'pt_PT',
    }
    for chromeLocale, operaLocale in operaMapping.iteritems():
      chromeFile = '_locales/%s/messages.json' % chromeLocale
      operaFile = '_locales/%s/messages.json' % operaLocale if operaLocale != None else None
      if chromeFile in files:
        if operaFile != None:
          files[operaFile] = files[chromeFile]
        del files[chromeFile]

def signBinary(zipdata, keyFile):
  import M2Crypto
  if not os.path.exists(keyFile):
    M2Crypto.RSA.gen_key(1024, 65537, callback=lambda x: None).save_key(keyFile, cipher=None)
  key = M2Crypto.EVP.load_key(keyFile)
  key.sign_init()
  key.sign_update(zipdata)
  return key.final()

def getPublicKey(keyFile):
  import M2Crypto
  return M2Crypto.EVP.load_key(keyFile).as_der()

def writePackage(outputFile, pubkey, signature, zipdata):
  if isinstance(outputFile, basestring):
    file = open(outputFile, 'wb')
  else:
    file = outputFile
  if pubkey != None and signature != None:
    file.write(struct.pack('<4sIII', 'Cr24', 2, len(pubkey), len(signature)))
    file.write(pubkey)
    file.write(signature)
  file.write(zipdata)

def createBuild(baseDir, type='chrome', outFile=None, buildNum=None, releaseBuild=False, keyFile=None, experimentalAPI=False, devenv=False):
  metadata = readMetadata(baseDir, type)
  version = getBuildVersion(baseDir, metadata, releaseBuild, buildNum)

  if outFile == None:
    outFile = getDefaultFileName(baseDir, metadata, version, 'crx' if keyFile else 'zip')

  params = {
    'type': type,
    'baseDir': baseDir,
    'releaseBuild': releaseBuild,
    'version': version,
    'experimentalAPI': experimentalAPI,
    'devenv': devenv,
    'metadata': metadata,
  }

  files = Files(getPackageFiles(params), getIgnoredFiles(params),
                process=lambda path, data: processFile(path, data, params))
  files['manifest.json'] = createManifest(params)
  if metadata.has_section('mapping'):
    files.readMappedFiles(metadata.items('mapping'))
  files.read(baseDir)

  if metadata.has_section('convert_js'):
    convertJS(params, files)

  if metadata.has_section('import_locales'):
    importGeckoLocales(params, files)

  if devenv:
    files['devenvPoller__.js'] = createPoller(params)

  zipdata = files.zipToString()
  signature = None
  pubkey = None
  if keyFile != None:
    signature = signBinary(zipdata, keyFile)
    pubkey = getPublicKey(keyFile)
  writePackage(outFile, pubkey, signature, zipdata)

def createDevEnv(baseDir, type):
  fileBuffer = StringIO()
  createBuild(baseDir, outFile=fileBuffer, devenv=True, releaseBuild=True)

  from zipfile import ZipFile
  zip = ZipFile(StringIO(fileBuffer.getvalue()), 'r')
  zip.extractall(os.path.join(baseDir, 'devenv'))
  zip.close()

  print 'Development environment created, waiting for connections from active extensions...'
  metadata = readMetadata(baseDir, type)
  connections = [0]

  import SocketServer, time, thread

  class ConnectionHandler(SocketServer.BaseRequestHandler):
    def handle(self):
      connections[0] += 1
      self.request.sendall('HTTP/1.0 OK\nConnection: close\n\n%s' % metadata.get('general', 'basename'))

  server = SocketServer.TCPServer(('localhost', 43816), ConnectionHandler)

  def shutdown_server(server):
    time.sleep(10)
    server.shutdown()
  thread.start_new_thread(shutdown_server, (server,))
  server.serve_forever()

  if connections[0] == 0:
    print 'Warning: No incoming connections, extension probably not active in the browser yet'
  else:
    print 'Handled %i connection(s)' % connections[0]
