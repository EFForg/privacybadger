#!/bin/bash

if ! [ -f ./release-utils/config.sh ] ; then
  echo "Missing config file. Cannot continue."
  exit 1
fi
source ./release-utils/config.sh

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET=$1
if ! git show release-"$TARGET" > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi

PKGDIR=pkg
CHROME_PKG=$PKGDIR/privacy_badger-"$TARGET".crx
if ! [ -f "$CHROME_PKG" ] ; then
  mv $PKGDIR/privacy-badger-"$TARGET".crx "$CHROME_PKG"
fi
CHROME_ALT=$PKGDIR/privacy_badger-chrome.crx
echo "Uploading chrome package"
cp "$CHROME_PKG" "$CHROME_ALT"
echo Copying .crx files...
scp "$CHROME_PKG" "$USER@$SERVER:/www/eff.org/files" || exit 1
scp "$CHROME_ALT" "$USER@$SERVER:/www/eff.org/files" || exit 1
