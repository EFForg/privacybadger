#!/bin/bash

set -e
cd "$(dirname "$0")"

PKGDIR=../pkg

# To make an Privacy Badger firefox release, signed with an offline key

# 1. get the repo into a sane state for a release
# 2. ensure that doc/Changelog approximately describes this release
# 3. tag the release with "git tag -s <release version number>"
# 4. run this script with <release version number> as the argument


if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET=$1


if ! git show release-"$TARGET" > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi

PKG=$PKGDIR/privacy-badger-eff-$TARGET.xpi
ALT=$PKGDIR/privacy-badger-eff-latest.xpi

if ! ./make-signed-xpi.sh "$TARGET" ; then
  echo "Failed to build target $TARGET XPI"
  exit 1
fi

if ! [ -f "$PKG" ] ; then
  echo "Failed to find package $PKG after build"
  exit 1
fi

# XXX: Why make a gpg detached sig?
echo "Making (secondary) GPG signature"
gpg --detach-sign "$PKG"

cp "$PKG" "$ALT"
