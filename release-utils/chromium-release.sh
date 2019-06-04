#!/bin/bash

if [ $# -ne 3 ]; then
  echo "$0 TAG KEY DESTINATION"
  exit
fi

SUBDIR=checkout
[ -d $SUBDIR ] && rm -rf $SUBDIR
mkdir $SUBDIR
cp -r -f -a .git $SUBDIR
cd $SUBDIR
git reset --hard "$1"

# clean up
# TODO duplicated in make-eff-zip.sh
rm -rf src/tests # remove unit tests
rm src/data/dnt-policy.txt # only used by unit tests
cp LICENSE src/ # include LICENSE in build

echo "Building chrome version" "$1"

chromium --pack-extension="src/" --pack-extension-key="$2"
cd -
mv checkout/src.crx "$3"
rm -rf checkout
