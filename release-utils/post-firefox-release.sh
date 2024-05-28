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
PKG="$PKGDIR"/privacy-badger-eff-"$TARGET".xpi
ALT="$PKGDIR"/privacy-badger-eff-latest.xpi

# auto-generated XPI name from 'web-ext sign'
PRE_XPI_NAME="$PKGDIR"/privacy_badger-"$TARGET".xpi
mv "$PRE_XPI_NAME" "$PKG"

if ! [ -f "$PKG" ] ; then
  echo "Failed to find package $PKG after build"
  exit 1
fi

# TODO Why make a gpg detached sig?
echo "Making (secondary) GPG signature"
gpg --detach-sign "$PKG"

cp "$PKG" "$ALT"

echo Copying .xpi files...
scp "$PKG" "$USER@$SERVER:/www/eff.org/files" || exit 1
scp "$ALT" "$USER@$SERVER:/www/eff.org/files" || exit 1
echo Copying detached signature
scp "$PKG".sig "$USER@$SERVER:/www/eff.org/files" || exit 1

echo "Now please edit https://www.eff.org/files/privacy-badger-updates.json to include the following"
echo ""
echo "{"
echo "  \"version\": \"$TARGET\","
echo "  \"update_link\": \"https://eff.org/files/privacy-badger-eff-$TARGET.xpi\","
echo "  \"update_hash\": \"sha256:$(sha256sum "$PKG" | cut -c 1-64)\","
echo "  \"browser_specific_settings\": {"
echo "    \"gecko\": { \"strict_min_version\": \"113.0\" },"
echo "    \"gecko_android\": { \"strict_min_version\": \"113.0\" }"
echo "  }"
echo "}"
