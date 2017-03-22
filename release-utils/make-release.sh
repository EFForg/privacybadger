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


if echo $TARGET | grep -q release- ; then
  GITTAG=$TARGET
  TARGET=`echo $TARGET | sed s/release-//`
else
  GITTAG=release-$TARGET
fi

if ! git show $GITTAG > /dev/null 2> /dev/null ; then
  echo "$GITTAG is not a valid git target"
  exit 1
fi

if ! [ -x `which festival` ] ; then
  echo "festival is not installed, cannot speak hashes aloud..."
fi

export PREPKG=pkg/privacy_badger-$TARGET.zip
export PREPKGCWS=pkg/privacy_badger-$TARGET.zip
export POSTPKG=pkg/privacy_badger-$TARGET.crx
export POSTPKGCWS=pkg/privacy_badger-$TARGET.crx
export DEVEL=0
export ALT=pkg/privacy_badger-chrome.crx
export UPDATEFILE=updates.xml  # lives in chromium/ but we can't access it in the build subdir
export UPDATEFILE2=privacy_badger-chrome-updates.xml
export SIGFILE=pkg/$TARGET.sig
export SIGFILECWS=pkg/$TARGET.sig


echo "Making chrome/opera release"
if ! release-utils/chromium-release.sh $TARGET; then
  echo "Failed to build target $TARGET for chrome"
  exit 1
fi

echo "Making firefox release"
if ! release-utils/firefox-release.sh $TARGET; then
  echo "Failed to build target $TARGET for firefox"
  exit 1
fi


./release-utils/post-release.sh $TARGET

rm -rf checkout
