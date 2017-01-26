#!/bin/sh
set -e
CURDIR="`dirname $0`"
cd "`dirname $0`"

LATEST_SDK_VERSION=1.6.0

# Auto-generated XPI name from 'web-ext sign'
PRE_XPI_NAME=privacy_badger_by_eff-$TARGET-an+fx.xpi
XPI_NAME="privacy-badger-eff-$1.xpi"
AMO_ZIP_NAME="privacy_badger-$1.amo.zip"

if ! type web-ext > /dev/null; then
  echo "Please install web-ext before running this script."
  exit 1
fi

if ! web-ext --version | grep -q "$LATEST_SDK_VERSION"; then
    echo "Please use the latest stable web-ext version or edit this script to the current version."
    exit 1
fi

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
echo "remove fingerprinting"
sed -i '/        "src\/fingerprinting.js",/d' ../checkout/manifest.json

echo "change author value"
sed -i 's/"author": { "email": "eff.software.projects@gmail.com" },/"author": "eff.software.projects@gmail.com",/' ../checkout/manifest.json

echo "making zip file for AMO"
pushd ../checkout
zip -r ../pkg/$AMO_ZIP_NAME *
popd

echo "insert self hosting package id"
# Insert self hosted package id
sed -i 's,"id": "jid1-MnnxcxisBPnSXQ@jetpack","id": "jid1-MnnxcxisBPnSXQ-eff@jetpack"\,\n      "update_url": "https://www.eff.org/files/privacy-badger-updates.json",' ../checkout/manifest.json

#"update_url": "https://www.eff.org/files/privacy-badger-updates.json"
# Build and sign the XPI 
echo "Running web-ext sign"
web-ext sign -s ../checkout --api-key $AMO_API_KEY --api-secret $AMO_API_SECRET -a ../pkg
mv "../pkg/$PRE_XPI_NAME" "../pkg/$XPI_NAME"
