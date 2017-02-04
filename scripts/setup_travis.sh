#!/bin/bash

# Install the latest version of the chromedriver
latest_version=$(wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE -q -O -)
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${latest_version}/chromedriver_linux64.zip"
sudo unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
sudo chmod a+x /usr/local/bin/chromedriver

# Install geckodriver
wget -O /tmp/geckodriver.tar.gz "https://github.com/mozilla/geckodriver/releases/download/v0.14.0/geckodriver-v0.14.0-linux64.tar.gz"
sudo tar -xvf /tmp/geckodriver.tar.gz -C /usr/local/bin/
sudo chmod a+x /usr/local/bin/geckodriver

# Set the path to the browser binary we want to test against
export BROWSER_BIN=`which ${BROWSER}`
