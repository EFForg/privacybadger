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

package LocaleTester;

use strict;
use warnings;

my %keepAccessKeys = map {$_ => $_} (
  'ja-JP',
  'ja',
  'ko-KR',
  'ko',
  'zh-CN',
  'zh-TW',
);

my @placeholders = (
  '?1?',
  '?2?',
  '?3?',
  '?4?',
  '?5?',
  '?6?',
  '?7?',
  '?8?',
  '?9?',
  '--',
  '%S',
  '[link]',
  '[/link]',
);

sub testLocales
{
  my %params = @_;
  die "Need at least one locale path to work on" unless exists($params{paths}) && %{$params{paths}};
  $params{mustDiffer} = [] unless exists($params{mustDiffer});
  $params{mustEqual} = [] unless exists($params{mustEqual});
  $params{ignoreUntranslated} = [] unless exists($params{ignoreUntranslated});
  $params{lengthRestrictions} = {} unless exists($params{lengthRestrictions});

  my @locales = sort {$a cmp $b} (exists($params{locales}) && @{$params{locales}} ? @{$params{locales}} : makeLocaleList($params{paths}));

  my $referenceLocale = readLocaleFiles($params{paths}, "en-US");

  foreach my $locale (@locales)
  {
    my $currentLocale = $locale eq "en-US" ? $referenceLocale : readLocaleFiles($params{paths}, $locale);

    compareLocales($locale, $currentLocale, $referenceLocale) unless $currentLocale == $referenceLocale;

    foreach my $entry (@{$params{mustDiffer}})
    {
      my %values = ();
      foreach my $key (@$entry)
      {
        my ($dir, $file, $name) = split(/:/, $key);
        next unless exists($currentLocale->{"$dir:$file"}) && exists($currentLocale->{"$dir:$file"}{$name}) && $currentLocale->{"$dir:$file"}{$name} =~ /\S/;
        my $value = lc($currentLocale->{"$dir:$file"}{$name});

        print "$locale: Values for '$values{$value}' and '$key' are identical, must differ\n" if exists $values{$value};
        $values{$value} = $key;
      }
    }

    foreach my $entry (@{$params{mustEqual}})
    {
      my $stdValue;
      my $stdName;
      foreach my $key (@$entry)
      {
        my ($dir, $file, $name) = split(/:/, $key);
        next unless exists($currentLocale->{"$dir:$file"}) && exists($currentLocale->{"$dir:$file"}{$name});
        my $value = lc($currentLocale->{"$dir:$file"}{$name});

        $stdValue = $value unless defined $stdValue;
        $stdName = $key unless defined $stdName;
        print "$locale: Values for '$stdName' and '$key' differ, must be equal\n" if $value ne $stdValue;
      }
    }

    foreach my $key (keys %{$params{lengthRestrictions}})
    {
      my $maxLength = $params{lengthRestrictions}{$key};
      my ($dir, $file, $name) = split(/:/, $key);
      print "$locale: Value of '$key' is too long, must not be longer than $maxLength characters\n" if exists($currentLocale->{"$dir:$file"}) && exists($currentLocale->{"$dir:$file"}{$name}) && length($currentLocale->{"$dir:$file"}{$name}) > $maxLength;
    }

    foreach my $file (keys %$currentLocale)
    {
      my $fileData = $currentLocale->{$file};
      foreach my $key (keys %$fileData)
      {
        if (($key =~ /\.accesskey$/ || $key =~ /\.key$/) && length($fileData->{$key}) != 1)
        {
          print "$locale: Length of accesskey '$file:$key' isn't 1 character\n";
        }

        if ($key =~ /\.accesskey$/)
        {
          if (exists($keepAccessKeys{$locale}))
          {
            if (exists($referenceLocale->{$file}{$key}) && lc($fileData->{$key}) ne lc($referenceLocale->{$file}{$key}))
            {
              print "$locale: Accesskey '$file:$key' should be the same as in the reference locale\n";
            }
          }
          else
          {
            my $labelKey = $key;
            $labelKey =~ s/\.accesskey$/.label/;
            if (exists($fileData->{$labelKey}) && $fileData->{$labelKey} !~ /\Q$fileData->{$key}/i)
            {
              print "$locale: Accesskey '$file:$key' not found in the corresponding label '$file:$labelKey'\n";
            }
          }
        }

        if ($currentLocale != $referenceLocale && $locale ne "en-GB" && exists($referenceLocale->{$file}{$key}) && length($fileData->{$key}) > 1 && $fileData->{$key} eq $referenceLocale->{$file}{$key})
        {
          my $ignore = 0;
          foreach my $re (@{$params{ignoreUntranslated}})
          {
            $ignore = 1 if "$file:$key" =~ $re;
          }
          print "$locale: Value of '$file:$key' is the same as in the reference locale, probably an untranslated string\n" unless $ignore;
        }

        if ($currentLocale != $referenceLocale && exists($referenceLocale->{$file}{$key}))
        {
          foreach my $placeholder (@placeholders)
          {
            print "$locale: Placeholder '$placeholder' missing in '$file:$key'\n" if index($referenceLocale->{$file}{$key}, $placeholder) >= 0 && index($currentLocale->{$file}{$key}, $placeholder) < 0;
          }
        }
      }
    }
  }
}

sub makeLocaleList
{
  my $paths = shift;

  my %locales = ();
  foreach my $dir (keys %$paths)
  {
    opendir(local* DIR, $paths->{$dir}) or next;
    my @locales = grep {!/[^\w\-]/ && !-e("$paths->{$dir}/$_/.incomplete")} readdir(DIR);
    $locales{$_} = 1 foreach @locales;
    closedir(DIR);
  }
  return keys %locales;
}

sub readFile
{
  my $file = shift;

  open(local *FILE, "<", $file) || die "Could not read file '$file'";
  binmode(FILE);
  local $/;
  my $result = <FILE>;
  close(FILE);

  print "Byte Order Mark found in file '$file'\n" if $result =~ /\xEF\xBB\xBF/;
  print "File '$file' is not valid UTF-8\n" unless (utf8::decode($result));

  return $result;
}

sub parseDTDFile
{
  my $file = shift;

  my %result = ();

  my $data = readFile($file);

  my $S = qr/[\x20\x09\x0D\x0A]/;
  my $Name = qr/[A-Za-z_:][\w.\-:]*/;
  my $Reference = qr/&$Name;|&#\d+;|&#x[\da-fA-F]+;/;
  my $PEReference = qr/%$Name;/;
  my $EntityValue = qr/\"((?:[^%&\"]|$PEReference|$Reference)*)\"|'((?:[^%&']|$PEReference|$Reference)*)'/;

  sub processEntityValue
  {
    my $text = shift;
    $text =~ s/&#(\d+);/chr($1)/ge;
    $text =~ s/&#x([\da-fA-F]+);/chr(hex($1))/ge;
    $text =~ s/&apos;/'/g;
    return $text;
  }

  # Remove comments
  $data =~ s/<!--([^\-]|-[^\-])*-->//gs;

  # Process entities
  while ($data =~ /<!ENTITY$S+($Name)$S+$EntityValue$S*>/gs)
  {
    my ($name, $value) = ($1, $2 || $3);
    $result{$name} = processEntityValue($value);
  }

  # Remove entities
  $data =~ s/<!ENTITY$S+$Name$S+$EntityValue$S*>//gs;

  # Remove spaces
  $data =~ s/^\s+//gs;
  $data =~ s/\s+$//gs;
  $data =~ s/\s+/ /gs;

  print "Unrecognized data in file '$file': $data\n" if $data ne '';

  return \%result;
}

sub parsePropertiesFile
{
  my $file = shift;

  my %result = ();

  my $data = readFile($file);
  while ($data =~ /^(.*)$/mg)
  {
    my $line = $1;

    # ignore comments
    next if $line =~ /^\s*[#!]/;

    if ($line =~ /=/)
    {
      my ($key, $value) = split(/=/, $line, 2);
      $result{$key} = $value;
    }
    elsif ($line =~ /\S/)
    {
      print "Unrecognized data in file '$file': $line\n";
    }
  }
  close(FILE);

  return \%result;
}

sub readLocaleFiles
{
  my $paths = shift;
  my $locale = shift;

  my %result = ();
  foreach my $dir (keys %$paths)
  {
    opendir(local *DIR, "$paths->{$dir}/$locale") or next;
    foreach my $file (readdir(DIR))
    {
      if ($file =~ /(.*)\.dtd$/)
      {
        $result{"$dir:$1"} = parseDTDFile("$paths->{$dir}/$locale/$file");
      }
      elsif ($file =~ /(.*)\.properties$/)
      {
        $result{"$dir:$1"} = parsePropertiesFile("$paths->{$dir}/$locale/$file");
      }
    }
    closedir(DIR);
  }

  return \%result;
}

sub compareLocales
{
  my ($locale, $current, $reference) = @_;

  my %hasFile = ();
  foreach my $file (keys %$current)
  {
    unless (exists($reference->{$file}))
    {
      print "$locale: Extra file '$file'\n";
      next;
    }
    $hasFile{$file} = 1;

    my %hasValue = ();
    foreach my $key (keys %{$current->{$file}})
    {
      unless (exists($reference->{$file}{$key}))
      {
        print "$locale: Extra value '$file:$key'\n";
        next;
      }
      $hasValue{$key} = 1;
    }

    foreach my $key (keys %{$reference->{$file}})
    {
      unless (exists($current->{$file}{$key}))
      {
        print "$locale: Missing value '$file:$key'\n";
        next;
      }
    }
  }

  foreach my $file (keys %$reference)
  {
    unless (exists($current->{$file}))
    {
      print "$locale: Missing file '$file'\n";
      next;
    }
  }
}

1;
