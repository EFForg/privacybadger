VERSION=$(grep '"version":' src/manifest.json | cut -c14- | sed 's/[",[:space:]\n]//g')
PREFIX=privacy_badger
(cd src && zip -q -r ../"$PREFIX-$VERSION.zip" .)
