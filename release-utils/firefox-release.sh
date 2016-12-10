#!/bin/bash

set -e
cd "`dirname $0`"

RDFDIR=../pkg/

# To make an Privacy Badger firefox release, signed with an offline key

# 1. get the repo into a sane state for a release
# 2. ensure that doc/Changelog approximately describes this release
# 3. tag the release with "git tag -s <release version number>"
# 4. run this script with <release version number> as the argument


if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi
TARGET=$1


if ! git show release-$TARGET > /dev/null 2> /dev/null ; then
  echo "$TARGET is not a valid git target"
  exit 1
fi

if ! [ -x `which festival` ] ; then
  echo "festival is not installed, cannot speak hashes aloud..."
fi

PKG=$RDFDIR/privacy-badger-eff-$TARGET.xpi
ALT=$RDFDIR/privacy-badger-eff-latest.xpi
RDFFILE=$RDFDIR/privacy-badger-eff-update-2048.rdf

LZMARDF=$RDFFILE.lzma
B_LZMARDF=$LZMARDF.b64

if ! ./make-signed-xpi.sh $TARGET ; then
  echo "Failed to build target $TARGET"
  exit 1
fi

if ! [ -f "$PKG" ] ; then
  echo "Failed to find package $PKG after build"
  exit 1
fi

# XXX: Why make a gpg detached sig?
echo "Making (secondary) GPG signature"
gpg --detach-sign $PKG

echo "Generating hash for FIREFOX"
echo HASH FOR SIGNING:
echo "(place the resulting .rdf.lzma.b64 in $B_LZMARDF)"
sha1sum $PKG
echo metahash for confirmation only $(sha1sum $PKG   |cut -d' ' -f1 | tr -d '\n' | sha1sum  | cut -c1-6) ...
echo
while read -p "Please enter a pastebin ID once the .rdf has been signed, or press Enter to read the hash aloud:  " INP && [ "$INP" = "" ] ; do
  cat $PKG | (echo "(Parameter.set 'Duration_Stretch 1.5)"; \
              echo -n '(SayText "'; \
              sha1sum | cut -c1-40 | fold -1 | sed 's/^a$/alpha/; s/^b$/bravo/; s/^c$/charlie/; s/^d$/delta/; s/^e$/echo/; s/^f$/foxtrot/'; \
              echo '")' ) | festival
done

if ! wget "http://pastebin.com/raw.php?i=$INP" --output-document="$B_LZMARDF" ; then
  echo "Failed to wget http://pastebin.com/download.php?i=$INP"
  exit 1
fi

# update rdf should be correctly signed

if ! [ -f $B_LZMARDF ] ; then
  echo "Failed to find $B_LZMARDF"'!'
  exit 1
fi

# wget gives us Windows newlines :(
cat $B_LZMARDF |tr -d '\r' |  base64 -d > $LZMARDF || exit 1
unlzma -f $LZMARDF || exit 1

if ! [ -f $RDFFILE ] ; then
  echo "Failed to find $RDFFILE"'!'
  exit 1
fi

cp $PKG $ALT
