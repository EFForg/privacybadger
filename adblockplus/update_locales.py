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

import sys, os, json, re, codecs
import buildtools.localeTools as localeTools

def updateLocale(localeDir, remove, rename):
  for source, target in rename.iteritems():
    sourceFile, sourceKey = source.split(' ', 1)
    targetFile, targetKey = target.split(' ', 1)

    sourceFile = os.path.join(localeDir, sourceFile)
    targetFile = os.path.join(localeDir, targetFile)
    if not os.path.exists(sourceFile):
      continue

    sourceData = localeTools.readFile(sourceFile)
    if sourceKey in sourceData:
      localeTools.appendToFile(targetFile, targetKey, sourceData[sourceKey])
    localeTools.removeFromFile(sourceFile, sourceKey)

  for entry in remove:
    if ' ' in entry:
      file, key = entry.split(' ', 1)
      file = os.path.join(localeDir, file)
      if os.path.exists(file):
        localeTools.removeFromFile(file, key)
    else:
      file = os.path.join(localeDir, entry)
      if os.path.exists(file):
        os.remove(file)

if __name__ == '__main__':
  localesDir = os.path.join('chrome', 'locale')
  remove = [
    'global.properties whitelist_description',
    'global.properties filterlist_description',
    'global.properties invalid_description',
    'global.properties elemhide_description',
    'global.properties subscription_description',
    'global.properties subscription_wrong_version',
    'global.properties subscription_source',
    'global.properties subscription_status',
    'global.properties subscription_status_autodownload',
    'global.properties subscription_status_manualdownload',
    'global.properties subscription_status_externaldownload',
    'global.properties import_filters_wrong_version',
    'global.properties import_filters_warning',
    'global.properties import_filters_title',
    'global.properties export_filters_title',
    'global.properties invalid_filters_file',
    'global.properties filters_write_error',
    'global.properties clearall_warning',
    'global.properties resethitcounts_warning',
    'global.properties resethitcounts_selected_warning',
    'global.properties subscription_notAdded_warning',
    'global.properties subscription_notAdded_warning_addendum',
    'global.properties overwrite',
    'global.properties append',
    'global.properties new_filter_group_title',
    'global.properties type_label_xbl',
    'global.properties type_label_ping',
    'global.properties type_label_dtd',
    'global.properties sync_engine_title',
    'global.properties fennec_status_enabled',
    'global.properties fennec_status_disabled',
    'global.properties fennec_status_enabled_site',
    'global.properties fennec_status_disabled_site',
    'overlay.dtd settings.label',
    'overlay.dtd settings.accesskey',
    'overlay.dtd recommend.label',
    'overlay.dtd view.blockableItems.label',
    'settings.dtd',
    'subscriptionSelection.dtd dialog.title.edit',
    'subscriptionSelection.dtd description.newInstall',
    'subscriptionSelection.dtd saveSubscription.label',
    'subscriptionSelection.dtd other.accesskey',
    'subscriptionSelection.dtd edit.description',
    'subscriptionSelection.dtd external.description',
    'subscriptionSelection.dtd autodownload.label',
    'subscriptionSelection.dtd autodownload.accesskey',
    'firstRun.dtd acceptableAds',
    'filters.dtd acceptableAds.label',
    'composer.dtd groupDisabled.warning',
  ]
  rename = {
    'global.properties subscription_status_lastdownload' : 'filters.dtd subscription.lastDownload.label',
    'global.properties subscription_status_lastdownload_inprogress' : 'filters.dtd subscription.lastDownload.inProgress',
    'global.properties subscription_status_lastdownload_unknown' : 'filters.dtd subscription.lastDownload.unknown',
    'global.properties synchronize_invalid_url' : 'filters.dtd subscription.lastDownload.invalidURL',
    'global.properties synchronize_connection_error' : 'filters.dtd subscription.lastDownload.connectionError',
    'global.properties synchronize_invalid_data' : 'filters.dtd subscription.lastDownload.invalidData',
    'global.properties synchronize_checksum_mismatch' : 'filters.dtd subscription.lastDownload.checksumMismatch',
    'global.properties synchronize_ok' : 'filters.dtd subscription.lastDownload.success',
    'global.properties synchronize_ok' : 'filters.dtd subscription.lastDownload.success',
    'settings.dtd options.label' : 'overlay.dtd options.label',
    'settings.dtd options.accesskey' : 'overlay.dtd options.accesskey',
    'settings.dtd showintoolbar.label' : 'overlay.dtd showintoolbar.label',
    'settings.dtd showintoolbar.accesskey' : 'overlay.dtd showintoolbar.accesskey',
    'settings.dtd showinstatusbar.label' : 'overlay.dtd showinstatusbar.label',
    'settings.dtd showinstatusbar.accesskey' : 'overlay.dtd showinstatusbar.accesskey',
    'settings.dtd showinaddonbar.label' : 'overlay.dtd showinaddonbar.label',
    'settings.dtd showinaddonbar.accesskey' : 'overlay.dtd showinaddonbar.accesskey',
    'settings.dtd objecttabs.label' : 'overlay.dtd objecttabs.label',
    'settings.dtd objecttabs.accesskey' : 'overlay.dtd objecttabs.accesskey',
    'settings.dtd sync.label' : 'overlay.dtd sync.label',
    'settings.dtd sync.accesskey' : 'overlay.dtd sync.accesskey',
    'settings.dtd add.label' : 'filters.dtd addFilter.label',
    'settings.dtd addsubscription.label' : 'filters.dtd addSubscription.label',
    'settings.dtd cut.label' : 'filters.dtd filter.cut.label',
    'settings.dtd copy.label' : 'filters.dtd filter.copy.label',
    'settings.dtd paste.label' : 'filters.dtd filter.paste.label',
    'settings.dtd remove.label' : 'filters.dtd filter.delete.label',
    'settings.dtd menu.find.label' : 'filters.dtd find.label',
    'settings.dtd view.label' : 'filters.dtd viewMenu.label',
    'settings.dtd sort.label' : 'filters.dtd sort.label',
    'settings.dtd sort.accesskey' : 'filters.dtd sort.accesskey',
    'settings.dtd sort.none.label' : 'filters.dtd sort.none.label',
    'settings.dtd sort.none.accesskey' : 'filters.dtd sort.none.accesskey',
    'settings.dtd sort.ascending.label' : 'filters.dtd sort.ascending.label',
    'settings.dtd sort.ascending.accesskey' : 'filters.dtd sort.ascending.accesskey',
    'settings.dtd sort.descending.label' : 'filters.dtd sort.descending.label',
    'settings.dtd sort.descending.accesskey' : 'filters.dtd sort.descending.accesskey',
    'settings.dtd filter.column' : 'filters.dtd filter.column',
    'settings.dtd filter.accesskey' : 'filters.dtd filter.accesskey',
    'settings.dtd slow.column' : 'filters.dtd slow.column',
    'settings.dtd slow.accesskey' : 'filters.dtd slow.accesskey',
    'settings.dtd enabled.column' : 'filters.dtd enabled.column',
    'settings.dtd enabled.accesskey' : 'filters.dtd enabled.accesskey',
    'settings.dtd hitcount.column' : 'filters.dtd hitcount.column',
    'settings.dtd hitcount.accesskey' : 'filters.dtd hitcount.accesskey',
    'settings.dtd lasthit.column' : 'filters.dtd lasthit.column',
    'settings.dtd lasthit.accesskey' : 'filters.dtd lasthit.accesskey',
    'settings.dtd slow.column' : 'filters.dtd slow.column',
    'settings.dtd slow.column' : 'filters.dtd slow.column',
    'subscriptionSelection.dtd other.label' : 'filters.dtd addSubscriptionOther.label',
  }

  for locale in os.listdir(localesDir):
    localeDir = os.path.join(localesDir, locale)
    if os.path.isdir(localeDir) and locale != 'en-US':
      updateLocale(localeDir, remove, rename)
