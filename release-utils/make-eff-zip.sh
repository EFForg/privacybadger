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

  if [ -d dist ]; then
    # new folder structure: https://github.com/EFForg/privacybadger/pull/1278
    rm -rf dist/tests # unit tests
    rm dist/data/dnt-policy.txt # only used by unit tests
  else
    # old folder structure
    for file in `cat ../scripts/exclude.lst`; do
      rm -rf "$file"
    done
  fi
else
  echo "Please supply a tag name for the release you are zipping"
  exit 1
fi


echo "Building chrome version" "$1"

if [ -d dist ]; then
  (cd dist && zip -q -r ../privacy_badger-"$TARGET".zip .)
else
  zip -q -r privacy_badger-"$TARGET".zip .
fi
mv privacy_badger*.zip ../pkg/
cd -

