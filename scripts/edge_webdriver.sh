#!/usr/bin/env bash

edge_version_major=$(microsoft-edge-beta --product-version | cut -d . -f 1)
edgedriver_version_url="https://msedgedriver.azureedge.net/LATEST_RELEASE_${edge_version_major}_LINUX"
edgedriver_version=$(curl -s "$edgedriver_version_url" | tr -d "\0\r\n" | cut -c 3-)
if [ -z "$edgedriver_version" ]; then
  echo "Failed to retrieve Edge WebDriver version!"
  exit 1
fi

echo "Installing Edge WebDriver version $edgedriver_version ..."
wget "https://msedgedriver.azureedge.net/${edgedriver_version}/edgedriver_linux64.zip"
unzip edgedriver_linux64.zip
sudo mv msedgedriver /usr/local/bin/
sudo chmod a+x /usr/local/bin/msedgedriver

# check that Edge WebDriver is now present
type msedgedriver >/dev/null 2>&1 || {
  echo "Failed to install Edge WebDriver"
  exit 1
}
