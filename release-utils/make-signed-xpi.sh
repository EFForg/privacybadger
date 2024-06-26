#!/bin/sh

set -e

cd "$(dirname "$0")"

LATEST_SDK_VERSION=8.2.0
WEB_EXT=../node_modules/.bin/web-ext
PATCHER=../scripts/patch_manifest.py

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

echo "Changing author value"
$PATCHER ../checkout/src/manifest.json 'set' 'author' 'privacybadger-owner@eff.org'

echo "Removing Chrome's update_url"
$PATCHER ../checkout/src/manifest.json 'del' 'update_url'

# lint the checkout folder
$WEB_EXT lint -s ../checkout/src

echo "Making zip file for AMO"

(cd ../checkout/src && rm -f ../../pkg/"$AMO_ZIP_NAME" && zip -q -r ../../pkg/"$AMO_ZIP_NAME" ./*)

echo "Inserting self-hosted package ID"
$PATCHER ../checkout/src/manifest.json 'set' 'browser_specific_settings.gecko.id' 'jid1-MnnxcxisBPnSXQ-eff@jetpack'
$PATCHER ../checkout/src/manifest.json 'set' 'browser_specific_settings.gecko.update_url' 'https://www.eff.org/files/privacy-badger-updates.json'

# lint checkout again as our modification above could have broken something
# disable AMO-specific checks to allow browser_specific_settings.gecko.update_url
$WEB_EXT lint -s ../checkout/src --self-hosted

echo "Making self-hosted XPI package with 'web-ext sign'"
$WEB_EXT sign -s ../checkout/src --channel unlisted --approval-timeout 0 --api-key "$AMO_API_KEY" --api-secret "$AMO_API_SECRET" -a ../pkg
mv "../pkg/$PRE_XPI_NAME" "../pkg/$XPI_NAME"
