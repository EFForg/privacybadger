#!/usr/bin/env bash

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

TEMPFILE=$(mktemp)
CHROME="$1"

trap 'rm $TEMPFILE' EXIT

# install the appropriate version of ChromeDriver
chrome_version=$("$CHROME" --product-version | cut -d . -f 1-3)
chromedriver_version_url=https://chromedriver.storage.googleapis.com/LATEST_RELEASE_"$chrome_version"
chromedriver_version=$(wget "$chromedriver_version_url" -q -O -)
echo "Setting up ChromeDriver version $chromedriver_version ..."
chromedriver_url=https://chromedriver.storage.googleapis.com/"$chromedriver_version"/chromedriver_linux64.zip
wget -q -O "$TEMPFILE" "$chromedriver_url"
sudo unzip -q -o "$TEMPFILE" chromedriver -d /usr/local/bin/
sudo chmod a+x /usr/local/bin/chromedriver

# check that chromedriver is now present
type chromedriver >/dev/null 2>&1 || {
  echo "Failed to install ChromeDriver!"
  exit 1
}
