#!/bin/bash
# Install chromedriver

if [ -x /usr/local/bin/chromedriver ]; then
    echo "You already have ChromeDriver installed. Skipping this step."
else
    machine=`uname -m`
    if [ $machine = "x86_64" ] ; then 
        bits="64"; 
    elif [ $machine = "i686" ] ; then 
        bits="32"; 
    fi;
    version="2.20"
    wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/$version/chromedriver_linux$bits.zip"
    sudo unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
    sudo chmod a+x /usr/local/bin/chromedriver
fi

# Install latest stable Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install google-chrome-stable
