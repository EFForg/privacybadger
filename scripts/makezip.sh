VERSION=$(grep '"version":' dist/manifest.json | cut -c14- | sed 's/[",[:space:]\n]//g')
PREFIX=privacy_badger
(cd dist && zip -q -r ../"$PREFIX-$VERSION.zip" .)
