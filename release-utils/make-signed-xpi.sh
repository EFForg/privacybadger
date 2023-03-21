#!/bin/sh

set -e

cd "$(dirname "$0")"

LATEST_SDK_VERSION=7.6.0
WEB_EXT=../node_modules/.bin/web-ext

# Auto-generated XPI name from 'web-ext sign'
PRE_XPI_NAME=privacy_badger-$1.xpi
XPI_NAME="privacy-badger-eff-$1.xpi"
AMO_ZIP_NAME="privacy_badger-$1.amo.zip"

if ! type $WEB_EXT > /dev/null; then
  echo "Please install web-ext before running this script."
  exit 1
fi

if ! $WEB_EXT --version | grep -q "$LATEST_SDK_VERSION"; then
  echo "Please use the latest stable web-ext version or edit this script to the current version."
  exit 1
fi

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version to release>"
  exit 1
fi

echo "changing author value"
sed -i -e '/eff.software.projects@gmail.com/,+1d' -e 's/"author": {/"author": "privacybadger-owner@eff.org",/' ../checkout/src/manifest.json

echo "removing Chrome's update_url"
# remove update_url
sed -i -e '/"update_url": "https:\/\/clients2.google.com\/service\/update2\/crx"/,+0d' ../checkout/src/manifest.json

# lint the checkout folder
$WEB_EXT lint -s ../checkout/src

echo "making zip file for AMO"

(cd ../checkout/src && rm -f ../../pkg/"$AMO_ZIP_NAME" && zip -q -r ../../pkg/"$AMO_ZIP_NAME" ./*)

echo "insert self hosting package id"
# Insert self hosted package id
sed -i 's,"id": "jid1-MnnxcxisBPnSXQ@jetpack","id": "jid1-MnnxcxisBPnSXQ-eff@jetpack"\,\n      "update_url": "https://www.eff.org/files/privacy-badger-updates.json",' ../checkout/src/manifest.json

# lint checkout again as our modification above could have broken something
# disable AMO-specific checks to allow applications.gecko.update_url
$WEB_EXT lint -s ../checkout/src --self-hosted

#"update_url": "https://www.eff.org/files/privacy-badger-updates.json"
# Build and sign the XPI 
echo "Running web-ext sign"
$WEB_EXT sign -s ../checkout/src --api-key "$AMO_API_KEY" --api-secret "$AMO_API_SECRET" -a ../pkg
mv "../pkg/$PRE_XPI_NAME" "../pkg/$XPI_NAME"
