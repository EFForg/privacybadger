#!/usr/bin/env bash

# Install the latest version of geckodriver
version=$(curl -sI https://github.com/mozilla/geckodriver/releases/latest | grep -i "^Location: " | sed 's/.*\///' | tr -d '\r')

# check that we got something
if [ -z "$version" ]; then
  echo "Failed to determine the latest Geckodriver version!"
  exit 1
fi

# Geckodriver distribution is MacOS or Linux specific
os="$(uname -s)"
if [[ $os == "Darwin" ]]; then
  os_dist="macos.tar.gz"
else
  os_dist="linux64.tar.gz"
fi

echo "Setting up Geckodriver version $version ..."
url="https://github.com/mozilla/geckodriver/releases/download/${version}/geckodriver-${version}-${os_dist}"
wget -q -O /tmp/geckodriver.tar.gz "$url"
sudo tar -xvf /tmp/geckodriver.tar.gz -C /usr/local/bin/
sudo chmod a+x /usr/local/bin/geckodriver

# check that geckodriver is now present
type geckodriver >/dev/null 2>&1 || {
  echo "Failed to install Geckodriver"
  exit 1
}
