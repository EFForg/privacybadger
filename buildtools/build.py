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

import os, sys, re, subprocess, buildtools
from getopt import getopt, GetoptError

knownTypes = ('gecko', 'chrome', 'opera')

class Command(object):
  name = property(lambda self: self._name)
  shortDescription = property(lambda self: self._shortDescription,
      lambda self, value: self.__dict__.update({'_shortDescription': value}))
  description = property(lambda self: self._description,
      lambda self, value: self.__dict__.update({'_description': value}))
  params = property(lambda self: self._params,
      lambda self, value: self.__dict__.update({'_params': value}))
  supportedTypes = property(lambda self: self._supportedTypes,
      lambda self, value: self.__dict__.update({'_supportedTypes': value}))
  options = property(lambda self: self._options)

  def __init__(self, handler, name):
    self._handler = handler
    self._name = name
    self._shortDescription = ''
    self._description = ''
    self._params = ''
    self._supportedTypes = None
    self._options = []
    self.addOption('Show this message and exit', short='h', long='help')

  def __enter__(self):
    return self

  def __exit__(self, exc_type, exc_value, traceback):
    pass

  def __call__(self, baseDir, scriptName, opts, args, type):
    return self._handler(baseDir, scriptName, opts, args, type)

  def isSupported(self, type):
    return self._supportedTypes == None or type in self._supportedTypes

  def addOption(self, description, short=None, long=None, value=None, types=None):
    self._options.append((description, short, long, value, types))

  def parseArgs(self, type, args):
    shortOptions = map(
      lambda o: o[1]+':' if o[3] != None else o[1],
      filter(
        lambda o: o[1] != None and (o[4] == None or type in o[4]),
        self._options
      )
    )
    longOptions = map(
      lambda o: o[2]+'=' if o[3] != None else o[2],
      filter(
        lambda o: o[2] != None and (o[4] == None or type in o[4]),
        self._options
      )
    )
    return getopt(args, ''.join(shortOptions), longOptions)


commandsList = []
commands = {}
def addCommand(handler, name):
  if isinstance(name, basestring):
    aliases = ()
  else:
    name, aliases = (name[0], name[1:])

  global commandsList, commands
  command = Command(handler, name)
  commandsList.append(command)
  commands[name] = command
  for alias in aliases:
    commands[alias] = command
  return command

def splitByLength(string, maxLen):
  parts = []
  currentPart = ''
  for match in re.finditer(r'\s*(\S+)', string):
    if len(match.group(0)) + len(currentPart) < maxLen:
      currentPart += match.group(0)
    else:
      parts.append(currentPart)
      currentPart = match.group(1)
  if len(currentPart):
    parts.append(currentPart)
  return parts

def usage(scriptName, type, commandName=None):
  if commandName == None:
    global commandsList
    descriptions = []
    for command in commandsList:
      if not command.isSupported(type):
        continue
      commandText = ('%s %s' % (command.name, command.params)).ljust(39)
      descriptionParts = splitByLength(command.shortDescription, 29)
      descriptions.append('  %s [-t %s] %s %s' % (scriptName, type, commandText, descriptionParts[0]))
      for part in descriptionParts[1:]:
        descriptions.append('  %s     %s  %s %s' % (' ' * len(scriptName), ' ' * len(type), ' ' * len(commandText), part))
    print '''Usage:

%(descriptions)s

For details on a command run:

  %(scriptName)s [-t %(type)s] <command> --help
''' % {
    'scriptName': scriptName,
    'type': type,
    'descriptions': '\n'.join(descriptions)
  }
  else:
    global commands
    command = commands[commandName]
    description = '\n'.join(map(lambda s: '\n'.join(splitByLength(s, 80)), command.description.split('\n')))
    options = []
    for descr, short, long, value, types in command.options:
      if types != None and type not in types:
        continue
      if short == None:
        shortText = ''
      elif value == None:
        shortText = '-%s' % short
      else:
        shortText = '-%s %s' % (short, value)
      if long == None:
        longText = ''
      elif value == None:
        longText = '--%s' % long
      else:
        longText = '--%s=%s' % (long, value)
      descrParts = splitByLength(descr, 46)
      options.append('  %s %s %s' % (shortText.ljust(11), longText.ljust(19), descrParts[0]))
      for part in descrParts[1:]:
        options.append('  %s %s %s' % (' ' * 11, ' ' * 19, part))
    print '''%(scriptName)s [-t %(type)s] %(name)s %(params)s

%(description)s

Options:
%(options)s
''' % {
      'scriptName': scriptName,
      'type': type,
      'name': command.name,
      'params': command.params,
      'description': description,
      'options': '\n'.join(options)
    }


def runBuild(baseDir, scriptName, opts, args, type):
  locales = None
  buildNum = None
  multicompartment = False
  releaseBuild = False
  keyFile = None
  experimentalAPI = False
  for option, value in opts:
    if option in ('-l', '--locales'):
      locales = value.split(',')
    elif option in ('-b', '--build'):
      buildNum = int(value)
    elif option in ('-k', '--key'):
      keyFile = value
    elif option in ('-m', '--multi-compartment'):
      multicompartment = True
    elif option in ('-r', '--release'):
      releaseBuild = True
    elif option == '--experimental':
      experimentalAPI = True
  outFile = args[0] if len(args) > 0 else None

  if type == 'gecko':
    import buildtools.packagerGecko as packager
    packager.createBuild(baseDir, type=type, outFile=outFile, locales=locales, buildNum=buildNum,
                         releaseBuild=releaseBuild, keyFile=keyFile,
                         multicompartment=multicompartment)
  elif type == 'chrome' or type == 'opera':
    import buildtools.packagerChrome as packager
    packager.createBuild(baseDir, type=type, outFile=outFile, buildNum=buildNum,
                         releaseBuild=releaseBuild, keyFile=keyFile,
                         experimentalAPI=experimentalAPI)


def runAutoInstall(baseDir, scriptName, opts, args, type):
  if len(args) == 0:
    print 'Port of the Extension Auto-Installer needs to be specified'
    usage(scriptName, type, 'autoinstall')
    return

  multicompartment = False
  for option, value in opts:
    if option in ('-m', '--multi-compartment'):
      multicompartment = True

  if ':' in args[0]:
    host, port = args[0].rsplit(':', 1)
  else:
    host, port = ('localhost', args[0])

  import buildtools.packagerGecko as packager
  packager.autoInstall(baseDir, type, host, port, multicompartment=multicompartment)


def createDevEnv(baseDir, scriptName, opts, args, type):
  import buildtools.packagerChrome as packager
  packager.createDevEnv(baseDir, type=type)


def setupTranslations(baseDir, scriptName, opts, args, type):
  if len(args) < 1:
    print 'Project key is required to update translation master files.'
    usage(scriptName, type, 'setuptrans')
    return

  key = args[0]

  if type == 'chrome' or type == 'opera':
    import buildtools.packagerChrome as packager
    locales = os.listdir(os.path.join(baseDir, '_locales'))
    locales = map(lambda locale: locale.replace('_', '-'), locales)
    basename = packager.readMetadata(baseDir, type).get('general', 'basename')
  else:
    import buildtools.packagerGecko as packager
    locales = packager.getLocales(baseDir, True)
    basename = packager.readMetadata(baseDir, type).get('general', 'basename')

  import buildtools.localeTools as localeTools
  localeTools.setupTranslations(type, locales, basename, key)


def updateTranslationMaster(baseDir, scriptName, opts, args, type):
  if len(args) < 1:
    print 'Project key is required to update translation master files.'
    usage(scriptName, type, 'translate')
    return

  key = args[0]

  if type == 'chrome' or type == 'opera':
    import buildtools.packagerChrome as packager
    defaultLocaleDir = os.path.join(baseDir, '_locales', packager.defaultLocale)
    metadata = packager.readMetadata(baseDir, type)
    basename = metadata.get('general', 'basename')
  else:
    import buildtools.packagerGecko as packager
    defaultLocaleDir = os.path.join(packager.getLocalesDir(baseDir), packager.defaultLocale)
    metadata = packager.readMetadata(baseDir, type)
    basename = metadata.get('general', 'basename')

  import buildtools.localeTools as localeTools
  localeTools.updateTranslationMaster(type, metadata, defaultLocaleDir, basename, key)


def uploadTranslations(baseDir, scriptName, opts, args, type):
  if len(args) < 1:
    print 'Project key is required to upload existing translations.'
    usage(scriptName, type, 'uploadtrans')
    return

  key = args[0]

  if type == 'chrome' or type == 'opera':
    import buildtools.packagerChrome as packager
    localesDir = os.path.join(baseDir, '_locales')
    locales = os.listdir(localesDir)
    locales = map(lambda locale: (locale.replace('_', '-'), os.path.join(localesDir, locale)), locales)
    metadata = packager.readMetadata(baseDir, type)
    basename = metadata.get('general', 'basename')
  else:
    import buildtools.packagerGecko as packager
    localesDir = packager.getLocalesDir(baseDir)
    locales = packager.getLocales(baseDir, True)
    locales = map(lambda locale: (locale, os.path.join(localesDir, locale)), locales)
    metadata = packager.readMetadata(baseDir, type)
    basename = metadata.get('general', 'basename')

  import buildtools.localeTools as localeTools
  for locale, localeDir in locales:
    if locale != packager.defaultLocale:
      localeTools.uploadTranslations(type, metadata, localeDir, locale, basename, key)


def getTranslations(baseDir, scriptName, opts, args, type):
  if len(args) < 1:
    print 'Project key is required to update translation master files.'
    usage(scriptName, type, 'translate')
    return

  key = args[0]
  if type == 'chrome' or type == 'opera':
    import buildtools.packagerChrome as packager
    localesDir = os.path.join(baseDir, '_locales')
  else:
    import buildtools.packagerGecko as packager
    localesDir = packager.getLocalesDir(baseDir)

  import buildtools.localeTools as localeTools
  basename = packager.readMetadata(baseDir, type).get('general', 'basename')
  localeTools.getTranslations(type, localesDir, packager.defaultLocale.replace('_', '-'), basename, key)


def showDescriptions(baseDir, scriptName, opts, args, type):
  locales = None
  for option, value in opts:
    if option in ('-l', '--locales'):
      locales = value.split(',')

  import buildtools.packagerGecko as packager
  if locales == None:
    locales = packager.getLocales(baseDir)
  elif locales == 'all':
    locales = packager.getLocales(baseDir, True)

  data = packager.readLocaleMetadata(baseDir, locales)
  localeCodes = data.keys()
  localeCodes.sort()
  for localeCode in localeCodes:
    locale = data[localeCode]
    print ('''%s
%s
%s
%s
%s
''' % (localeCode,
       locale['name'] if 'name' in locale else 'None',
       locale['description'] if 'description' in locale else 'None',
       locale['description.short'] if 'description.short' in locale else 'None',
       locale['description.long'] if 'description.long' in locale else 'None',
      )).encode('utf-8')


def generateDocs(baseDir, scriptName, opts, args, type):
  if len(args) == 0:
    print 'No target directory specified for the documentation'
    usage(scriptName, type, 'docs')
    return
  targetDir = args[0]

  toolkit = None
  quiet = False
  for option, value in opts:
    if option in ('-t', '--toolkit'):
      toolkit = value
    elif option in ('-q', '--quiet'):
      quiet = True

  if toolkit == None:
    toolkit = os.path.join(baseDir, 'jsdoc-toolkit')
    if not os.path.exists(toolkit):
      subprocess.check_call(['hg', 'clone', 'https://hg.adblockplus.org/jsdoc-toolkit/', toolkit])

  command = [os.path.join(toolkit, 'jsrun.js'),
             '-t=' + os.path.join(toolkit, 'templates', 'jsdoc'),
             '-d=' + targetDir,
             '-a',
             '-p',
             '-x=js,jsm',
             os.path.join(baseDir, 'lib')]
  if quiet:
    subprocess.check_output(command)
  else:
    subprocess.check_call(command)

def runReleaseAutomation(baseDir, scriptName, opts, args, type):
  keyFile = None
  downloadsRepo = os.path.join(baseDir, '..', 'downloads')
  for option, value in opts:
    if option in ('-k', '--key'):
      keyFile = value
    elif option in ('-d', '--downloads'):
      downloadsRepo = value

  if type == 'gecko':
    if len(args) == 0:
      print 'No version number specified for the release'
      usage(scriptName, type, 'release')
      return
    version = args[0]
    if re.search(r'[^\w\.]', version):
      print 'Wrong version number format'
      usage(scriptName, type, 'release')
      return

    if keyFile == None:
      print 'Warning: no key file specified, creating an unsigned release build\n'

    import buildtools.releaseAutomationGecko as releaseAutomation
    releaseAutomation.run(baseDir, type, version, keyFile, downloadsRepo)

def updatePSL(baseDir, scriptName, opts, args, type):
  import buildtools.publicSuffixListUpdater as publicSuffixListUpdater
  publicSuffixListUpdater.updatePSL(baseDir)

with addCommand(lambda baseDir, scriptName, opts, args, type: usage(scriptName, type), ('help', '-h', '--help')) as command:
  command.shortDescription = 'Show this message'

with addCommand(runBuild, 'build') as command:
  command.shortDescription = 'Create a build'
  command.description = 'Creates an extension build with given file name. If output_file is missing a default name will be chosen.'
  command.params = '[options] [output_file]'
  command.addOption('Only include the given locales (if omitted: all locales not marked as incomplete)', short='l', long='locales', value='l1,l2,l3', types=('gecko'))
  command.addOption('Use given build number (if omitted the build number will be retrieved from Mercurial)', short='b', long='build', value='num')
  command.addOption('File containing private key and certificates required to sign the package', short='k', long='key', value='file', types=('gecko', 'chrome', 'opera'))
  command.addOption('Create a build for leak testing', short='m', long='multi-compartment', types=('gecko'))
  command.addOption('Create a release build', short='r', long='release')
  command.addOption('Enable use of experimental APIs', long='experimental')
  command.supportedTypes = ('gecko', 'chrome', 'opera')

with addCommand(runAutoInstall, 'autoinstall') as command:
  command.shortDescription = 'Install extension automatically'
  command.description = 'Will automatically install the extension in a browser running Extension Auto-Installer. If host parameter is omitted assumes that the browser runs on localhost.'
  command.params = '[<host>:]<port>'
  command.addOption('Create a build for leak testing', short='m', long='multi-compartment')
  command.supportedTypes = ('gecko')

with addCommand(createDevEnv, 'devenv') as command:
  command.shortDescription = 'Set up a development environment'
  command.description = 'Will set up or update the devenv folder as an unpacked extension folder for development.'
  command.supportedTypes = ('chrome', 'opera')

with addCommand(setupTranslations, 'setuptrans') as command:
  command.shortDescription = 'Sets up translation languages'
  command.description = 'Sets up translation languages for the project on crowdin.net.'
  command.params = '[options] project-key'
  command.supportedTypes = ('gecko', 'chrome', 'opera')

with addCommand(updateTranslationMaster, 'translate') as command:
  command.shortDescription = 'Updates translation master files'
  command.description = 'Updates the translation master files in the project on crowdin.net.'
  command.params = '[options] project-key'
  command.supportedTypes = ('gecko', 'chrome', 'opera')

with addCommand(uploadTranslations, 'uploadtrans') as command:
  command.shortDescription = 'Uploads existing translations'
  command.description = 'Uploads already existing translations to the project on crowdin.net.'
  command.params = '[options] project-key'
  command.supportedTypes = ('gecko', 'chrome', 'opera')

with addCommand(getTranslations, 'gettranslations') as command:
  command.shortDescription = 'Downloads translation updates'
  command.description = 'Downloads updated translations from crowdin.net.'
  command.params = '[options] project-key'
  command.supportedTypes = ('gecko', 'chrome', 'opera')

with addCommand(showDescriptions, 'showdesc') as command:
  command.shortDescription = 'Print description strings for all locales'
  command.description = 'Display description strings for all locales as specified in the corresponding meta.properties files.'
  command.addOption('Only include the given locales', short='l', long='locales', value='l1,l2,l3')
  command.params = '[options]'
  command.supportedTypes = ('gecko')

with addCommand(generateDocs, 'docs') as command:
  command.shortDescription = 'Generate documentation (requires node.js)'
  command.description = 'Generate documentation files and write them into the specified directory. This operation requires node.js to be installed.'
  command.addOption('JsDoc Toolkit location', short='t', long='toolkit', value='dir')
  command.addOption('Suppress JsDoc Toolkit output', short='q', long='quiet')
  command.params = '[options] <directory>'
  command.supportedTypes = ('gecko')

with addCommand(runReleaseAutomation, 'release') as command:
  command.shortDescription = 'Run release automation'
  command.description = 'Note: If you are not the project owner then you '\
    'probably don\'t want to run this!\n\n'\
    'Runs release automation: creates downloads for the new version, tags '\
    'source code repository as well as downloads and buildtools repository.'
  command.addOption('File containing private key and certificates required to sign the release', short='k', long='key', value='file', types=('gecko'))
  command.addOption('Directory containing downloads repository (if omitted ../downloads is assumed)', short='d', long='downloads', value='dir')
  command.params = '[options] <version>'
  command.supportedTypes = ('gecko')

with addCommand(updatePSL, 'updatepsl') as command:
  command.shortDescription = 'Updates Public Suffix List'
  command.description = 'Downloads Public Suffix List (see http://publicsuffix.org/) and generates lib/publicSuffixList.js from it.'
  command.supportedTypes = ('chrome', 'opera')

def getType(baseDir, scriptName, args):
  # Look for an explicit type parameter (has to be the first parameter)
  if len(args) >= 2 and args[0] == '-t':
    type = args[1]
    del args[1]
    del args[0]
    if type not in knownTypes:
      print '''
Unknown type %s specified, supported types are: %s
''' % (type, ', '.join(knownTypes))
      return None
    return type

  # Try to guess repository type
  types = []
  for t in knownTypes:
    if os.path.exists(os.path.join(baseDir, 'metadata.%s' % t)):
      types.append(t)

  if len(types) == 1:
    return types[0]
  elif len(types) > 1:
    print '''
Ambiguous repository type, please specify -t parameter explicitly, e.g.
%s -t %s build
''' % (scriptName, types[0])
    return None
  else:
    print '''
No metadata file found in this repository, a metadata file like
metadata.%s is required.
''' % knownTypes[0]
    return None

def processArgs(baseDir, args):
  global commands

  scriptName = os.path.basename(args[0])
  args = args[1:]
  type = getType(baseDir, scriptName, args)
  if type == None:
    return

  if len(args) == 0:
    args = ['build']
    print '''
No command given, assuming "build". For a list of commands run:

  %s help
''' % scriptName

  command = args[0]
  if command in commands:
    if commands[command].isSupported(type):
      try:
        opts, args = commands[command].parseArgs(type, args[1:])
      except GetoptError, e:
        print str(e)
        usage(scriptName, type, command)
        sys.exit(2)
      for option, value in opts:
        if option in ('-h', '--help'):
          usage(scriptName, type, command)
          sys.exit()
      commands[command](baseDir, scriptName, opts, args, type)
    else:
      print 'Command %s is not supported for this application type' % command
      usage(scriptName, type)
  else:
    print 'Command %s is unrecognized' % command
    usage(scriptName, type)
