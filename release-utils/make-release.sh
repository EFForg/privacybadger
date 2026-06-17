#!/bin/bash

# To make a privacy badger release see wiki

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
export TARGET=$1
export GITTAG

if ! [ -f ./release-utils/config.sh ] ; then
  echo "Missing config file. Cannot continue."
  exit 1
fi
source ./release-utils/config.sh

if ! [ -d ../privacybadger_assets ] ; then
  echo "Missing assets folder. Cannot continue."
  exit 1
fi

if echo "$TARGET" | grep -q release- ; then
  GITTAG=$TARGET
  TARGET=$(echo "$TARGET" | sed s/release-//)
else
  GITTAG=release-$TARGET
fi

if ! git show "$GITTAG" > /dev/null 2> /dev/null ; then
  echo "$GITTAG is not a valid git target"
  exit 1
fi

# TODO we don't use this zip for Chrome/Opera/Edge at this point
# TODO but we do rely on the changes producing it makes to the checkout folder
# TODO to make the Firefox zip below
echo "Making zip"
if ! release-utils/make-release-zip.sh "$TARGET"; then
  echo "Failed to build target $TARGET zip"
  exit 1
fi

echo "Making Firefox zip (for AMO and Edge) and Firefox XPI (for self hosting)"
if ! release-utils/firefox-release.sh "$TARGET"; then
  echo "Failed to build target $TARGET for Firefox"
  exit 1
fi

./release-utils/post-release.sh "$TARGET"

rm -rf checkout
