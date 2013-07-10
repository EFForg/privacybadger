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

import re, os, sys, codecs, json, urllib, urllib2
from StringIO import StringIO
from ConfigParser import SafeConfigParser
from zipfile import ZipFile
from xml.parsers.expat import ParserCreate, XML_PARAM_ENTITY_PARSING_ALWAYS

langMappingGecko = {
  'bn-BD': 'bn',
  'br': 'br-FR',
  'dsb': 'dsb-DE',
  'fj-FJ': 'fj',
  'hsb': 'hsb-DE',
  'hi-IN': 'hi',
  'ml': 'ml-IN',
  'nb-NO': 'nb',
  'rm': 'rm-CH',
  'ta-LK': 'ta',
  'wo-SN': 'wo',
}

langMappingChrome = {
  'es-419': 'es-AR',
  'es': 'es-ES',
  'sv': 'sv-SE',
  'ml': 'ml-IN',
}

chromeLocales = [
  "am",
  "ar",
  "bg",
  "bn",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "en-GB",
  "en-US",
  "es-419",
  "es",
  "et",
  "fa",
  "fi",
  "fil",
  "fr",
  "gu",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "kn",
  "ko",
  "lt",
  "lv",
  "ml",
  "mr",
  "ms",
  "nb",
  "nl",
  "pl",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "sw",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "vi",
  "zh-CN",
  "zh-TW",
]

class OrderedDict(dict):
  def __init__(self):
    self.__order = []
  def __setitem__(self, key, value):
    self.__order.append(key)
    dict.__setitem__(self, key, value)
  def iteritems(self):
    done = set()
    for key in self.__order:
      if not key in done and key in self:
        yield (key, self[key])
        done.add(key)

def escapeEntity(value):
  return value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def unescapeEntity(value):
  return value.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')

def mapLocale(type, locale):
  mapping = langMappingChrome if type == 'chrome' else langMappingGecko
  return mapping.get(locale, locale)

def parseDTDString(data, path):
  result = []
  currentComment = [None]

  parser = ParserCreate()
  parser.UseForeignDTD(True)
  parser.SetParamEntityParsing(XML_PARAM_ENTITY_PARSING_ALWAYS)

  def ExternalEntityRefHandler(context, base, systemId, publicId):
    subparser = parser.ExternalEntityParserCreate(context, 'utf-8')
    subparser.Parse(data.encode('utf-8'), True)
    return 1

  def CommentHandler(data):
    currentComment[0] = data.strip()

  def EntityDeclHandler(entityName, is_parameter_entity, value, base, systemId, publicId, notationName):
    result.append((unescapeEntity(entityName), currentComment[0], unescapeEntity(value.strip())))
    currentComment[0] = None

  parser.ExternalEntityRefHandler = ExternalEntityRefHandler
  parser.CommentHandler = CommentHandler
  parser.EntityDeclHandler = EntityDeclHandler
  parser.Parse('<!DOCTYPE root SYSTEM "foo"><root/>', True)

  for entry in result:
    yield entry

def escapeProperty(value):
  return value.replace('\n', '\\n')

def unescapeProperty(value):
  return value.replace('\\n', '\n')

def parsePropertiesString(data, path):
  currentComment = None
  for line in data.splitlines():
    match = re.search(r'^\s*[#!]\s*(.*)', line)
    if match:
      currentComment = match.group(1)
    elif '=' in line:
      key, value = line.split('=', 1)
      yield (unescapeProperty(key), currentComment, unescapeProperty(value))
      currentComment = None
    elif re.search(r'\S', line):
      print >>sys.stderr, 'Unrecognized data in file %s: %s' % (path, line)

def parseString(data, path):
  result = {'_origData': data}
  if path.endswith('.dtd'):
    it = parseDTDString(data, path)
  elif path.endswith('.properties'):
    it = parsePropertiesString(data, path)
  else:
    return None

  for name, comment, value in it:
    result[name] = value
  return result

def readFile(path):
  fileHandle = codecs.open(path, 'rb', encoding='utf-8')
  data = fileHandle.read()
  fileHandle.close()
  return parseString(data, path)

def generateStringEntry(key, value, path):
  if path.endswith('.dtd'):
    return '<!ENTITY %s "%s">\n' % (escapeEntity(key), escapeEntity(value))
  else:
    return '%s=%s\n' % (escapeProperty(key), escapeProperty(value))

def appendToFile(path, key, value):
  fileHandle = codecs.open(path, 'ab', encoding='utf-8')
  fileHandle.write(generateStringEntry(key, value, path))
  fileHandle.close()

def removeFromFile(path, key):
  fileHandle = codecs.open(path, 'rb', encoding='utf-8')
  data = fileHandle.read()
  fileHandle.close()

  if path.endswith('.dtd'):
    data = re.sub(r'<!ENTITY\s+%s\s+"[^"]*">\s*' % key, '', data, re.S)
  else:
    data = re.sub(r'(^|\n)%s=[^\n]*\n' % key, r'\1', data, re.S)

  fileHandle = codecs.open(path, 'wb', encoding='utf-8')
  fileHandle.write(data)
  fileHandle.close()

def toJSON(path):
  fileHandle = codecs.open(path, 'rb', encoding='utf-8')
  data = fileHandle.read()
  fileHandle.close()

  if path.endswith('.dtd'):
    it = parseDTDString(data, path)
  elif path.endswith('.properties'):
    it = parsePropertiesString(data, path)
  else:
    return None

  result = OrderedDict()
  for name, comment, value in it:
    obj = {'message': value}
    if comment == None:
      obj['description'] = name
    else:
      obj['description'] = '%s: %s' % (name, comment)
    result[name] = obj
  return json.dumps(result, ensure_ascii=False, indent=2)

def fromJSON(path, data):
  data = json.loads(data)
  if not data:
    if os.path.exists(path):
      os.remove(path)
    return

  dir = os.path.dirname(path)
  if not os.path.exists(dir):
    os.makedirs(dir)
  file = codecs.open(path, 'wb', encoding='utf-8')
  for key, value in data.iteritems():
    file.write(generateStringEntry(key, value['message'], path))
  file.close()

def preprocessChromeLocale(path, metadata, isMaster):
  fileHandle = codecs.open(path, 'rb', encoding='utf-8')
  data = json.load(fileHandle)
  fileHandle.close()

  for key, value in data.iteritems():
    if isMaster:
      # Make sure the key name is listed in the description
      if "description" in value:
        value["description"] = "%s: %s" % (key, value["description"])
      else:
        value["description"] = key
    else:
      # Delete description from translations
      if "description" in value:
        del value["description"]

  return json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2)

def postprocessChromeLocale(path, data):
  parsed = json.loads(data)

  # Delete description from translations
  for key, value in parsed.iteritems():
    if "description" in value:
      del value["description"]

  file = codecs.open(path, 'wb', encoding='utf-8')
  json.dump(parsed, file, ensure_ascii=False, sort_keys=True, indent=2, separators=(',', ': '))
  file.close()

def setupTranslations(type, locales, projectName, key):
  # Copy locales list, we don't want to change the parameter
  locales = set(locales)

  # Fill up with locales that we don't have but the browser supports
  if type == 'chrome':
    for locale in chromeLocales:
      locales.add(locale)
  else:
    firefoxLocales = urllib2.urlopen('http://www.mozilla.org/en-US/firefox/all.html').read()
    for match in re.finditer(r'&amp;lang=([\w\-]+)"', firefoxLocales):
      locales.add(mapLocale(type, match.group(1)))
    langPacks = urllib2.urlopen('https://addons.mozilla.org/en-US/firefox/language-tools/').read()
    for match in re.finditer(r'<tr>.*?</tr>', langPacks, re.S):
      if match.group(0).find('Install Language Pack') >= 0:
        match2 = re.search(r'lang="([\w\-]+)"', match.group(0))
        if match2:
          locales.add(mapLocale(type, match2.group(1)))

  # Convert locale codes to the ones that Crowdin will understand
  locales = set(map(lambda locale: mapLocale(type, locale), locales))

  allowed = set()
  allowedLocales = urllib2.urlopen('http://crowdin.net/page/language-codes').read()
  for match in re.finditer(r'<tr>\s*<td\b[^<>]*>([\w\-]+)</td>', allowedLocales, re.S):
    allowed.add(match.group(1))
  if not allowed.issuperset(locales):
    print 'Warning, following locales aren\'t allowed by server: ' + ', '.join(locales - allowed)

  locales = list(locales & allowed)
  locales.sort()
  params = urllib.urlencode([('languages[]', locale) for locale in locales])
  result = urllib2.urlopen('http://api.crowdin.net/api/project/%s/edit-project?key=%s&%s' % (projectName, key, params)).read()
  if result.find('<success') < 0:
    raise Exception('Server indicated that the operation was not successful\n' + result)

def postFiles(files, url):
  boundary = '----------ThIs_Is_tHe_bouNdaRY_$'
  body = ''
  for file, data in files:
    body += '--%s\r\n' % boundary
    body += 'Content-Disposition: form-data; name="files[%s]"; filename="%s"\r\n' % (file, file)
    body += 'Content-Type: application/octet-stream\r\n'
    body += 'Content-Transfer-Encoding: binary\r\n'
    body += '\r\n' + data + '\r\n'
  body += '--%s--\r\n' % boundary

  body = body.encode('utf-8')
  request = urllib2.Request(url, StringIO(body))
  request.add_header('Content-Type', 'multipart/form-data; boundary=%s' % boundary)
  request.add_header('Content-Length', len(body))
  result = urllib2.urlopen(request).read()
  if result.find('<success') < 0:
    raise Exception('Server indicated that the operation was not successful\n' + result)

def updateTranslationMaster(type, metadata, dir, projectName, key):
  result = json.load(urllib2.urlopen('http://api.crowdin.net/api/project/%s/info?key=%s&json=1' % (projectName, key)))

  existing = set(map(lambda f: f['name'], result['files']))
  add = []
  update = []
  for file in os.listdir(dir):
    path = os.path.join(dir, file)
    if os.path.isfile(path):
      if type == 'chrome' and file.endswith('.json'):
        data = preprocessChromeLocale(path, metadata, True)
        newName = file
      elif type == 'chrome':
        fileHandle = codecs.open(path, 'rb', encoding='utf-8')
        data = json.dumps({file: {'message': fileHandle.read()}})
        fileHandle.close()
        newName = file + '.json'
      else:
        data = toJSON(path)
        newName = file + '.json'

      if data:
        if newName in existing:
          update.append((newName, data))
          existing.remove(newName)
        else:
          add.append((newName, data))

  if len(add):
    titles = urllib.urlencode([('titles[%s]' % name, re.sub(r'\.json', '', name)) for name, data in add])
    postFiles(add, 'http://api.crowdin.net/api/project/%s/add-file?key=%s&type=chrome&%s' % (projectName, key, titles))
  if len(update):
    postFiles(update, 'http://api.crowdin.net/api/project/%s/update-file?key=%s' % (projectName, key))
  for file in existing:
    result = urllib2.urlopen('http://api.crowdin.net/api/project/%s/delete-file?key=%s&file=%s' % (projectName, key, file)).read()
    if result.find('<success') < 0:
      raise Exception('Server indicated that the operation was not successful\n' + result)

def uploadTranslations(type, metadata, dir, locale, projectName, key):
  files = []
  for file in os.listdir(dir):
    path = os.path.join(dir, file)
    if os.path.isfile(path):
      if type == 'chrome' and file.endswith('.json'):
        data = preprocessChromeLocale(path, metadata, False)
        newName = file
      elif type == 'chrome':
        fileHandle = codecs.open(path, 'rb', encoding='utf-8')
        data = json.dumps({file: {'message': fileHandle.read()}})
        fileHandle.close()
        newName = file + '.json'
      else:
        data = toJSON(path)
        newName = file + '.json'

      if data:
        files.append((newName, data))
  if len(files):
    postFiles(files, 'http://api.crowdin.net/api/project/%s/upload-translation?key=%s&language=%s' % (projectName, key, mapLocale(type, locale)))

def getTranslations(type, localesDir, defaultLocale, projectName, key):
  result = urllib2.urlopen('http://api.crowdin.net/api/project/%s/export?key=%s' % (projectName, key)).read()
  if result.find('<success') < 0:
    raise Exception('Server indicated that the operation was not successful\n' + result)

  result = urllib2.urlopen('http://api.crowdin.net/api/project/%s/download/all.zip?key=%s' % (projectName, key)).read()
  zip = ZipFile(StringIO(result))
  dirs = {}
  for info in zip.infolist():
    if not info.filename.endswith('.json'):
      continue

    dir, file = os.path.split(info.filename)
    if not re.match(r'^[\w\-]+$', dir) or dir == defaultLocale:
      continue
    if type == 'chrome' and file.count('.') == 1:
      origFile = file
    else:
      origFile = re.sub(r'\.json$', '', file)
    if type == 'gecko' and not origFile.endswith('.dtd') and not origFile.endswith('.properties'):
      continue

    mapping = langMappingChrome if type == 'chrome' else langMappingGecko
    for key, value in mapping.iteritems():
      if value == dir:
        dir = key
    if type == 'chrome':
      dir = dir.replace('-', '_')

    data = zip.open(info.filename).read()
    if data == '[]':
      continue

    if not dir in dirs:
      dirs[dir] = set()
    dirs[dir].add(origFile)

    path = os.path.join(localesDir, dir, origFile)
    if not os.path.exists(os.path.dirname(path)):
      os.makedirs(os.path.dirname(path))
    if type == 'chrome' and origFile.endswith('.json'):
      postprocessChromeLocale(path, data)
    elif type == 'chrome':
      data = json.loads(data)
      if origFile in data:
        fileHandle = codecs.open(path, 'wb', encoding='utf-8')
        fileHandle.write(data[origFile]['message'])
        fileHandle.close()
    else:
      fromJSON(path, data)

  # Remove any extra files
  for dir, files in dirs.iteritems():
    baseDir = os.path.join(localesDir, dir)
    if not os.path.exists(baseDir):
      continue
    for file in os.listdir(baseDir):
      path = os.path.join(baseDir, file)
      if os.path.isfile(path) and (file.endswith('.json') or file.endswith('.properties') or file.endswith('.dtd')) and not file in files:
        os.remove(path)
