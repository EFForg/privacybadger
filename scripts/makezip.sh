VERSION=`grep '"version":' manifest.json | cut -c14- | sed 's/[",[:space:]\n]//g'`
PREFIX=privacy_badger-chrome
zip -q -r $PREFIX-$VERSION.zip . -x@scripts/exclude.lst
