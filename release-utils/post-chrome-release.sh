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
CHROME_ALT=$PKGDIR/privacy_badger-chrome.crx

curl -L "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.6778.204&acceptformat=crx2,crx3&x=id%3Dpkehgijcmpdhfbdbbnkijodmdjhbjlgp%26uc" > "$CHROME_PKG"

if [ ! -s "$CHROME_PKG" ]; then
  echo "Failed to download CRX from Chrome Web Store"
  exit 1
fi

cp "$CHROME_PKG" "$CHROME_ALT"

echo "Uploading Chrome packages ..."
scp "$CHROME_PKG" "$USER@$SERVER:/www/eff.org/files" || exit 1
scp "$CHROME_ALT" "$USER@$SERVER:/www/eff.org/files" || exit 1
