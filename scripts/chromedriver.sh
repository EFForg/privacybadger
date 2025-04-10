#!/usr/bin/env bash

# installs the appropriate version of ChromeDriver for a given Chrome version

TEMPDIR=$(mktemp -d)
trap 'rm -rf $TEMPDIR' EXIT

# one of google-chrome, google-chrome-stable,
# google-chrome-beta, or google-chrome-unstable
CHROME="${1:-google-chrome}"

major_version=$("$CHROME" --product-version | cut -d . -f 1)

if [ -z "$major_version" ]; then
  echo "Failed to look up version of $CHROME"
  exit 1
fi

if [ "$major_version" -lt 115 ]; then
  echo "This script supports installing ChromeDriver for Chrome 115+ only"
  exit 1
fi

channel=Stable
case "$CHROME" in
  *beta*)
    channel=Beta
    ;;
  *unstable*)
    channel=Dev
    ;;
esac
json_url=https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json
json=$(wget "$json_url" -q -O -)
chromedriver_version=$(echo "$json" | python3 -c "import sys, json; print(json.load(sys.stdin)['channels']['$channel']['version'])")
chromedriver_url=$(echo "$json" | python3 -c "import sys, json; print(next(i['url'] for i in json.load(sys.stdin)['channels']['$channel']['downloads']['chromedriver'] if i['platform'] == 'linux64'))")

if [ -z "$chromedriver_version" ]; then
  echo "Failed to retrieve ChromeDriver version"
  exit 1
fi

echo "Setting up ChromeDriver version $chromedriver_version ..."

wget -q -O "$TEMPDIR/chromedriver.zip" "$chromedriver_url" \
  && unzip -q -o "$TEMPDIR/chromedriver.zip" chromedriver-linux64/chromedriver -d "$TEMPDIR" \
  && sudo mv "$TEMPDIR/chromedriver-linux64/chromedriver" /usr/local/bin/chromedriver \
  && sudo chmod a+x /usr/local/bin/chromedriver

# check that chromedriver is now present
type chromedriver >/dev/null 2>&1 || {
  echo "Failed to install ChromeDriver!"
  exit 1
}

chromedriver --version
