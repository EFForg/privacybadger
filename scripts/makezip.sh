VERSION=`grep '"version":' manifest.json | cut -c14- | sed 's/[",[:space:]\n]//g'`
PREFIX=privacy_badger
zip -q -r $PREFIX-$VERSION.zip .
