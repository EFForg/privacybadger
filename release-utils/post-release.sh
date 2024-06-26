#!/bin/bash

cd "$(dirname "$0")"
source ./config.sh
if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET=$1
if ! git show release-"$TARGET" > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi

echo Copying Changelog.txt
git show release-"$TARGET":doc/Changelog > /tmp/pbchangelog$$ || exit 1
scp /tmp/pbchangelog$$ "$USER@$SERVER:/www/eff.org/files/pbChangelog.txt" || exit 1
rm -f /tmp/changelog$$

MSG=/tmp/email$$

echo "Privacy Badger $TARGET has been released for all supported browsers." > $MSG
echo "" >> $MSG
echo "Notable updates:" >> $MSG
echo "" >> $MSG
tail -n+4 ../doc/Changelog | sed '/^$/q' | grep -Ev '^[0-9]{4}\.[0-9\.]+$' >> $MSG
echo "For further details, consult our release notes on GitHub:" >> $MSG
echo "https://github.com/EFForg/privacybadger/releases/tag/release-$TARGET" >> $MSG
echo "" >> $MSG
echo "To install Privacy Badger, visit https://privacybadger.org/" >> $MSG

echo To send email to the mailing list...
echo mutt -s "Privacy\ Badger\ version\ $TARGET\ released" privacybadger@eff.org '<' $MSG

echo ""
echo "AMO release notes:"
echo ""
echo "<ul>"
tail -n+4 ../doc/Changelog | sed '/^$/q' | grep -Ev '^[0-9]{4}\.[0-9\.]+$' | {
  out=""
  while IFS= read -r line; do
    # changelog entries start with "*"
    if [ "${line:0:1}" = "*" ]; then
      # this is the first entry
      if [ -z "$out" ]; then
        out="<li>${line:2}"
      else
        out="$out</li>\n<li>${line:2}"
      fi
    # changelog entry continues
    else
      if [ -n "$line" ]; then
        out="$out $line"
      fi
    fi
  done
  echo -e "$out</li>"
}
echo "</ul>"
echo ""
