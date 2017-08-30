#!/usr/bin/env bash

# Half-build a .crx of HTTPS Everywhere for Chrome

# This version stops at a .zip file, so that it can be signed
# it takes a mandatory argument which is the git tag to build

if [ -n "$1" ]; then
  SUBDIR=checkout
  [ -d $SUBDIR ] && rm -rf $SUBDIR
  mkdir $SUBDIR
  cp -r -f -a .git $SUBDIR
  cd $SUBDIR
  git reset --hard "$1"

  # clean up
  rm -rf src/tests # remove unit tests
  rm src/data/dnt-policy.txt # only used by unit tests
  rm src/data/dnt-policies-example.json # only used by unit tests
  cp LICENSE src/ # include LICENSE in build

else
  echo "Please supply a tag name for the release you are zipping"
  exit 1
fi


echo "Building chrome version" "$1"

(cd src && zip -q -r ../privacy_badger-"$TARGET".zip .)
mv privacy_badger*.zip ../pkg/
cd -

