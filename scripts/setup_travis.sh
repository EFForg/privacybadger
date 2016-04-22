#!/bin/bash
# Install chromedriver

if [ -x /usr/local/bin/chromedriver ]; then
    echo "You already have ChromeDriver installed. Skipping this step."
else
    latest_version=$(wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE -q -O -)
    wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${latest_version}/chromedriver_linux64.zip"
    sudo unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
    sudo chmod a+x /usr/local/bin/chromedriver
fi
