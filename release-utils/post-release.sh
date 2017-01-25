#!/bin/bash
cd "`dirname $0`"
RDFDIR=../pkg/
if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET=$1
if ! git show release-$TARGET > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi
PKG=$RDFDIR/privacy-badger-eff-$TARGET.xpi
ALT=$RDFDIR/privacy-badger-eff-latest.xpi
RDFFILE=$RDFDIR/privacy-badger-eff-update-2048.rdf
CHROME_PKG=$RDFDIR/privacy_badger-$TARGET.crx
CHROME_ALT=$RDFDIR/privacy_badger-chrome.crx
echo Copying .xpi files...
scp $PKG $USER@$SERVER:/www/eff.org/docs/files/ || exit 1
scp $ALT $USER@$SERVER:/www/eff.org/docs/files/ || exit 1
echo Copying .rdf file...
scp $RDFFILE $USER@$SERVER:/www/eff.org/docs/files/ || exit 1
echo Copying detached signature
scp $PKG.sig $USER@$SERVER:/www/eff.org/docs/files/ || exit 1
echo "Uploading chrome package"
cp $CHROME_PKG $CHROME_ALT
echo Copying .crx files...
scp $CHROME_PKG $USER@$SERVER:/www/eff.org/files/ || exit 1
scp $CHROME_ALT $USER@$SERVER:/www/eff.org/files/ || exit 1
echo Copying update.xml file...
scp $UPDATETMP $USER@$SERVER:/www/eff.org/files/$UPDATEFILE2 || exit 1
echo Copying Changelog.txt
git show $TARGET:doc/Changelog > /tmp/pbchangelog$$ || exit 1
scp /tmp/pbchangelog$$ $USER@$SERVER:/www/eff.org/docs/files/pbChangelog.txt || exit 1
rm -f /tmp/changelog$$
echo Clearing varnish cache on $SERVER...
ssh -t $USER@$SERVER /www/eff.org/clear_cache/clear_cache

MSG=/tmp/email$$
echo "Privacy Badger for Chrome $TARGET has been released:" > $MSG
echo "" >> $MSG
echo "https://www.eff.org/files/`basename $PREPKG`" >> $MSG
echo "" >> $MSG
echo "From the Changelog:" >> $MSG
echo "" >> $MSG
cat doc/Changelog | sed '/^$/q' >> $MSG

  if [ `grep $GITTAG $MSG | wc -l` -lt  2 ] ; then
    echo Looks like Changelog failed to autogenerate correctly in $MSG ;
    echo please email the list manually.
  else
    echo To send email to the mailing list...
    echo mutt -s "$TARGET\ for\ Chromium\ released" privacybadger@eff.org '<' $MSG
  fi
echo "Now please edit https://www.eff.org/files/privacy-badger-updates.json to include the following"
echo ""
echo "{ \"version\": \"$TARGET\","
echo "  \"update_link\": \"https://eff.org/files/privacy-badger-eff-$TARGET.xpi\","
echo "  \"update_hash\": \"sha-256:`sha256sum $PKG | cut -c 1-64`\","
echo "  \"applications\": {"
echo "    \"gecko\": { \"strict_min_version\": \"50.0.2\" } "
echo "  } "
echo "},"
echo ""
echo "Now please upload $POSTPKGCWS to the Chrome Developer Dashboard"
echo "Also please edit https://eff.org/privacybadger to point to this release number"
echo "And check to confirm that the previous release is auto-updating to this one."
MSG=/tmp/email$$
echo "Privacy Badger $TARGET has been released:" > $MSG
echo "" >> $MSG
echo "https://www.eff.org/files/`basename $PKG`" >> $MSG
echo "" >> $MSG
echo "From the Changelog:" >> $MSG
echo "" >> $MSG
cat /tmp/pbchangelog$$ | sed '/^$/q' >> $MSG
rm -f /tmp/pbchangelog$$
