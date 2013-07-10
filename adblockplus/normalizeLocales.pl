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

# This script will adjust the locales as received from Babelzilla - normalize
# newlines and remove comments that have been pointlessly copied over from
# en-US.
 
use strict;
use warnings;

$0 =~ s/(.*[\\\/])//g;
chdir($1) if $1;

opendir(local* LOCALES, "chrome/locale") or die "Failed to open directory chrome/locale";
foreach my $locale (readdir(LOCALES))
{
  next if $locale =~ /^\./ || $locale eq "en-US" || $locale eq "de" || $locale eq "ru";

  foreach my $file (<chrome/locale/$locale/*.properties>)
  {
    my $data = readFile($file);
    $data =~ s/\r//g;                   # Normalize newlines
    $data =~ s/\n+/\n/g;                # Remove empty lines
    $data =~ s/\\+?(\\n|'|")/$1/g;      # Remove double escapes
    $data =~ s/^\s*#.*\n*//gm;          # Remove pointless comments
    writeFile($file, $data);

    unlink($file) if -z $file;
  }

  foreach my $file (<chrome/locale/$locale/*.dtd>)
  {
    my $data = readFile($file);
    $data =~ s/\r//g;                         # Normalize newlines
    $data =~ s/\\n/\n/g;                      # Replace misencoded newlines by regular ones
    $data =~ s/\\(\n|'|"|&)/$1/g;             # Remove wrong escapes
    $data =~ s/\n+/\n/g;                      # Remove empty lines
    $data =~ s/[^\S\n]*<!--.*?-->\s*?\n*//gs; # Remove pointless comments
    writeFile($file, $data);

    unlink($file) if -z $file;
  }
}
closedir(LOCALES);

sub readFile
{
  my $file = shift;

  open(local *FILE, "<", $file) || die "Could not read file '$file'";
  binmode(FILE);
  local $/;
  my $result = <FILE>;
  close(FILE);

  return $result;
}

sub writeFile
{
  my ($file, $contents) = @_;

  open(local *FILE, ">", $file) || die "Could not write file '$file'";
  binmode(FILE);
  print FILE $contents;
  close(FILE);
}
