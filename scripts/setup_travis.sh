#!/bin/bash

# Install the latest version of the chromedriver
latest_version=$(wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE -q -O -)
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${latest_version}/chromedriver_linux64.zip"
sudo unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
sudo chmod a+x /usr/local/bin/chromedriver

# Set the path to the browser binary we want to test against
export BROWSER_BIN=`which ${CHROME_PATH}`
