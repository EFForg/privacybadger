#!/bin/bash

set -e

cd "$(dirname "$0")"

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET="$1"

LATEST_SDK_VERSION=8.5.0
WEB_EXT=../node_modules/.bin/web-ext
PATCHER=../scripts/patch_manifest.py

AMO_ZIP_NAME=privacy_badger-"$TARGET".amo.zip

if ! git show release-"$TARGET" > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi

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

# re-lint as our modifications above could have broken something;
# disable AMO-specific checks to allow browser_specific_settings.gecko.update_url
$WEB_EXT lint -s ../checkout/src --self-hosted

echo "Making self-hosted XPI package with 'web-ext sign'"
$WEB_EXT sign -s ../checkout/src --channel unlisted --approval-timeout 0 --api-key "$AMO_API_KEY" --api-secret "$AMO_API_SECRET" -a ../pkg
