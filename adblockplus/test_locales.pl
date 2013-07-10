#!/usr/bin/perl

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

use strict;
use warnings;
use lib qw(buildtools);

$0 =~ s/(.*[\\\/])//g;
chdir($1) if $1;

system("hg", "clone", "https://hg.adblockplus.org/buildtools/") unless -e "buildtools";

require LocaleTester;

my %paths = (
  abp => 'chrome/locale',
  ehh => '../elemhidehelper/chrome/locale',
);

my @mustDiffer = (
  ['abp:overlay:opensidebar.accesskey', 'abp:overlay:sendReport.accesskey', 'abp:overlay:filters.accesskey', 'abp:overlay:options.accesskey', 'ehh:overlay:selectelement.accesskey'],
  [
    'abp:overlay:showintoolbar.accesskey', 'abp:overlay:showinstatusbar.accesskey',
    'abp:overlay:objecttabs.accesskey', 'abp:overlay:hideplaceholders.accesskey',
    'abp:overlay:counthits.accesskey', 'abp:overlay:sync.accesskey'
  ],
  [
    'abp:overlay:showinaddonbar.accesskey', 'abp:overlay:showinstatusbar.accesskey',
    'abp:overlay:objecttabs.accesskey', 'abp:overlay:hideplaceholders.accesskey',
    'abp:overlay:counthits.accesskey', 'abp:overlay:sync.accesskey'
  ],
  ['abp:subscriptionSelection:title.accesskey', 'abp:subscriptionSelection:location.accesskey', 'abp:subscriptionSelection:addMain.accesskey'],
  ['abp:composer:filter.accesskey', 'abp:composer:preferences.accesskey', 'abp:composer:type.filter.accesskey', 'abp:composer:type.whitelist.accesskey', 'abp:composer:custom.pattern.accesskey', 'abp:composer:anchor.start.accesskey', 'abp:composer:anchor.end.accesskey', 'abp:composer:domainRestriction.accesskey', 'abp:composer:firstParty.accesskey', 'abp:composer:thirdParty.accesskey', 'abp:composer:matchCase.accesskey', 'abp:composer:collapse.accesskey'],
  ['abp:sendReport:typeSelector.falsePositive.accesskey', 'abp:sendReport:typeSelector.falseNegative.accesskey', 'abp:sendReport:typeSelector.other.accesskey', 'abp:sendReport:recentReports.clear.accesskey'],
  ['abp:sendReport:typeWarning.override.accesskey', 'abp:sendReport:reloadButton.accesskey'],
  ['abp:sendReport:screenshot.attach.accesskey', 'abp:sendReport:screenshot.mark.accesskey', 'abp:sendReport:screenshot.remove.accesskey', 'abp:sendReport:screenshot.undo.accesskey'],
  ['abp:sendReport:comment.accesskey', 'abp:sendReport:email.accesskey', 'abp:sendReport:attachExtensions.accesskey', 'abp:sendReport:sendButton.accesskey', 'abp:sendReport:data.accesskey'],
  [
    'abp:filters:addSubscription.accesskey', 'abp:filters:acceptableAds.accesskey',
    'abp:filters:addFilter.accesskey', 'abp:filters:backupButton.accesskey',
    'abp:filters:find.accesskey',
  ],
  [
    'abp:filters:addGroup.accesskey',
    'abp:filters:addFilter.accesskey', 'abp:filters:backupButton.accesskey',
    'abp:filters:find.accesskey',
  ],
  [
    'abp:filters:filter.accesskey', 'abp:filters:slow.accesskey',
    'abp:filters:enabled.accesskey', 'abp:filters:hitcount.accesskey',
    'abp:filters:lasthit.accesskey', 'abp:filters:sort.accesskey',
  ],
  [
    'abp:filters:sort.none.accesskey',
    'abp:filters:filter.accesskey', 'abp:filters:slow.accesskey',
    'abp:filters:enabled.accesskey', 'abp:filters:hitcount.accesskey',
    'abp:filters:lasthit.accesskey',
    'abp:filters:sort.ascending.accesskey',
    'abp:filters:sort.descending.accesskey',
  ],
  [
    'ehh:global:command.select.key', 'ehh:global:command.select.alternativeKey',
    'ehh:global:command.wider.key', 'ehh:global:command.wider.alternativeKey',
    'ehh:global:command.narrower.key', 'ehh:global:command.narrower.alternativeKey',
    'ehh:global:command.lock.key', 'ehh:global:command.lock.alternativeKey',
    'ehh:global:command.quit.key', 'ehh:global:command.quit.alternativeKey',
    'ehh:global:command.blinkElement.key', 'ehh:global:command.blinkElement.alternativeKey',
    'ehh:global:command.viewSource.key', 'ehh:global:command.viewSource.alternativeKey',
    'ehh:global:command.viewSourceWindow.key', 'ehh:global:command.viewSourceWindow.alternativeKey',
    'ehh:global:command.showMenu.key', 'ehh:global:command.showMenu.alternativeKey',
  ],
);

my @mustEqual = (
  ['abp:overlay:opensidebar.accesskey', 'abp:overlay:closesidebar.accesskey'],
  ['abp:composer:anchor.start.accesskey', 'abp:composer:anchor.start.flexible.accesskey'],
  ['ehh:overlay:selectelement.accesskey', 'ehh:overlay:stopselection.accesskey'],
);

my @ignoreUntranslated = (
  qr/\.url$/,
  quotemeta("abp:about:caption.title"),
  quotemeta("abp:about:version.title"),
  quotemeta("abp:global:default_dialog_title"),
  quotemeta("abp:global:status_active_label"),
  quotemeta("abp:global:type_label_document"),
  quotemeta("abp:global:type_label_dtd"),
  quotemeta("abp:global:type_label_ping"),
  quotemeta("abp:global:type_label_script"),
  quotemeta("abp:global:type_label_stylesheet"),
  quotemeta("abp:global:type_label_xbl"),
  quotemeta("abp:global:subscription_status"),
  quotemeta("abp:global:subscription_status_lastdownload_unknown"),
  quotemeta("abp:overlay:status.tooltip"),
  quotemeta("abp:overlay:toolbarbutton.label"),
  quotemeta("abp:settings:filters.label"),
  quotemeta("abp:sidebar:filter.label"),
  quotemeta("abp:meta:name"),
  quotemeta("abp:meta:homepage"),
  quotemeta("ehh:composer:nodes-tree.class.label"),
  quotemeta("ehh:composer:nodes-tree.id.label"),
  quotemeta("ehh:global:noabp_warning_title"),
  quotemeta("ehh:meta:name"),
);

my %lengthRestrictions = (
  'abp:meta:description.short' => 250,
  'ehh:meta:description.short' => 250,
);
 
LocaleTester::testLocales(
  paths => \%paths,
  locales => \@ARGV,
  mustDiffer => \@mustDiffer,
  mustEqual => \@mustEqual,
  ignoreUntranslated => \@ignoreUntranslated,
  lengthRestrictions => \%lengthRestrictions,
);
