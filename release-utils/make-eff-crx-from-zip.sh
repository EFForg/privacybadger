#!/usr/bin/env bash

if [ $# != 2 ] || ! [ -f "$1" ] || ! [ -f "$2" ] ; then
  echo USAGE:
  echo
  echo "    "$0 "<zip file> <signature file>"
  echo
  echo "(run this in the privacy-badger root dir)"
  exit 1
fi

pub=release-utils/eff-pubkey.der
sig="$2"
zip="$1"
crx=`echo $zip | sed s/zip/crx/`
echo making $crx
byte_swap () {
  # Take "abcdefgh" and return it as "ghefcdab"
  echo "${1:6:2}${1:4:2}${1:2:2}${1:0:2}"
}

crmagic_hex="4372 3234" # Cr24
version_hex="0200 0000" # 2
pub_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$pub" | awk '{print $5}')))
sig_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$sig" | awk '{print $5}')))
(
  echo "$crmagic_hex $version_hex $pub_len_hex $sig_len_hex" | xxd -r -p
  cat "$pub" "$sig" "$zip"
) > "$crx"
echo >&2 "Created $crx"
