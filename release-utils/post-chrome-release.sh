#!/bin/bash

if ! [ -d ../privacybadger_assets ] ; then
  echo "Missing assets folder. Cannot continue."
  exit 1
fi

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi

PKGDIR=pkg
CHROME_PKG=$PKGDIR/privacy_badger-"$1".crx
CHROME_ALT=$PKGDIR/privacy_badger-chrome.crx

curl -L "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.6778.204&acceptformat=crx2,crx3&x=id%3Dpkehgijcmpdhfbdbbnkijodmdjhbjlgp%26uc" > "$CHROME_PKG"

if [ ! -s "$CHROME_PKG" ]; then
  echo "Failed to download CRX from Chrome Web Store"
  exit 1
fi

cp "$CHROME_PKG" "$CHROME_ALT"

echo "Copying Chrome CRXs to assets repo"
cp "$CHROME_PKG" ../privacybadger_assets/files || exit 1
cp "$CHROME_ALT" ../privacybadger_assets/files || exit 1
