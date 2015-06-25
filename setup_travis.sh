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
    version="2.12"
    wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/$version/chromedriver_linux$bits.zip"
    sudo unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
    sudo chmod a+x /usr/local/bin/chromedriver
fi
