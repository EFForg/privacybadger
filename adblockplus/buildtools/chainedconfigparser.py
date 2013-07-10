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

import os, codecs, ConfigParser

class Item(tuple):
  def __new__(cls, name, value, source):
    result = super(Item, cls).__new__(cls, (name, value))
    result.source = source
    return result

class ChainedConfigParser:
  """
    This class provides essentially the same interfaces as SafeConfigParser but
    allows chaining configuration files so that one config file provides the
    default values for the other. To specify the config file to inherit from
    a config file needs to contain the following option:

    [default]
    inherit = foo/bar.config

    The value of the inherit option has to be a relative path with forward
    slashes as delimiters. Up to 5 configuration files can be chained this way,
    longer chains are disallowed to deal with circular references.

    A main API difference to SafeConfigParser is the way a class instance is
    constructed: a file path has to be passed, this file is assumed to be
    encoded as UTF-8. Also, ChainedConfigParser data is read-only and the
    options are case-sensitive. An additional option_source(section, option)
    method is provided to get the path of the configuration file defining this
    option (for relative paths). Items returned by the items() function also
    have a source attribute serving the same purpose.
  """

  def __init__(self, path):
    self.chain = []
    self.read_path(path)

  def read_path(self, path):
    if len(self.chain) >= 5:
      raise Exception('Too much inheritance in config files')

    config = ConfigParser.SafeConfigParser()
    config.optionxform = str
    config.source_path = path
    handle = codecs.open(path, 'rb', encoding='utf-8')
    config.readfp(handle)
    handle.close()
    self.chain.append(config)

    if config.has_section('default') and config.has_option('default', 'inherit'):
      parts = config.get('default', 'inherit').split('/')
      defaults_path = os.path.join(os.path.dirname(path), *parts)
      self.read_path(defaults_path)

  def defaults(self):
    result = {}
    for config in reverse(self.chain):
      for key, value in config.defaults().iteritems():
        result[key] = value
    return result

  def sections(self):
    result = set()
    for config in self.chain:
      for section in config.sections():
        result.add(section)
    return list(result)

  def has_section(self, section):
    for config in self.chain:
      if config.has_section(section):
        return True
    return False

  def options(self, section):
    result = set()
    for config in self.chain:
      if config.has_section(section):
        for option in config.options(section):
          result.add(option)
    return list(result)

  def has_option(self, section, option):
    for config in self.chain:
      if config.has_section(section) and config.has_option(section, option):
        return True
    return False

  def get(self, section, option):
    for config in self.chain:
      if config.has_section(section) and config.has_option(section, option):
        return config.get(section, option)
    raise ConfigParser.NoOptionError(option, section)

  def items(self, section):
    seen = set()
    result = []
    for config in self.chain:
      if config.has_section(section):
        for name, value in config.items(section):
          if name not in seen:
            seen.add(name)
            result.append(Item(name, value, config.source_path))
    return result

  def option_source(self, section, option):
    for config in self.chain:
      if config.has_section(section) and config.has_option(section, option):
        return config.source_path
    raise ConfigParser.NoOptionError(option, section)
