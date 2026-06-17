#!/bin/bash

cd "$(dirname "$0")"

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET=$1
if ! git show release-"$TARGET" > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi

changelog_tmp=$(mktemp)
echo; echo "Copying changelog ($changelog_tmp) to assets repo"
git show release-"$TARGET":doc/Changelog > "$changelog_tmp" || exit 1
cp "$changelog_tmp" ../../privacybadger_assets/files/pbChangelog.txt || exit 1
rm "$changelog_tmp"

echo ""
echo "AMO release notes:"
echo ""
tail -n+4 ../../privacybadger_assets/files/pbChangelog.txt | sed '/^$/q' | grep -Ev '^[0-9]{4}\.[0-9\.]+$' | {
  out=""
  while IFS= read -r line; do
    # changelog entries start with "*"
    if [ "${line:0:1}" = "*" ]; then
      # this is the first entry
      if [ -z "$out" ]; then
        out="$line"
      else
        out="$out\n$line"
      fi
    # changelog entry continues
    else
      if [ -n "$line" ]; then
        out="$out $line"
      fi
    fi
  done
  echo -e "$out"
}
echo ""
