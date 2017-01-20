#!/bin/bash
blank=.chrome-profile

if [ ! -d $blank ]; then
  echo "No existing profile, please bootstrap by going to chrome://extensions"
  echo "enable developer mode, load privacy badger unpacked and then exiting the browser"
  sleep 2
  chromium-browser "chrome://extensions" --user-data-dir=$blank --new-window
fi

tmp=`mktemp -d`
cp -r $blank/* $tmp
chromium-browser "chrome://extensions" --user-data-dir=$tmp --new-window
# deletes the temp directory
function cleanup {
  rm -rf "$tmp"
  echo "Deleted temp working directory $tmp"
}

# register the cleanup function to be called on the EXIT signal
trap cleanup EXIT
