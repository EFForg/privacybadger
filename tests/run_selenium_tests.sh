#!/bin/bash
if [ -x /usr/local/bin/chromedriver ]; then
	echo "Will use ChromeDriver at /usr/local/bin/chromedriver"
elif [ -x /usr/lib/chromium-browser/chromedriver ]; then
        export PATH=$PATH:/usr/lib/chromium-browser
        echo "Will use ChromeDriver at /usr/lib/chromium-browser/chromedriver"
elif [ -x /usr/lib/chromium/chromedriver ]; then
        export PATH=$PATH:/usr/lib/chromium
        echo "Will use ChromeDriver at /usr/lib/chromium/chromedriver"
else
	echo "Could not find ChromeDriver in the PATH. Aborting!"
	exit 1
fi

pushd .
cd ..
make  # pack the extension
ext_path=`ls -1tr $PWD/*.crx | tail -n 1` # get the last modified crx
popd

trap 'rm -rf PBTESTENV' EXIT  # Clean virtualenv dir on exit
virtualenv PBTESTENV
source PBTESTENV/bin/activate
pip install -r sel_requirements.txt

# TODO: take command line arguments to set the following environment variables
export PB_EXT_PATH=$ext_path  # extension on this path will be used in the tests
# if this var is empty, extension base dir will be searched for the last modified .crx.
export BROWSER_BIN=""   # Path to the browser binary. Optional.
# If empty, Selenium will pick the default binary for the selected browser.
# To run tests with Chromium (instead of default Google Chrome) export BROWSER_BIN="/usr/bin/chromium-browser"
export ENABLE_XVFB=1    # run the tests headless using Xvfb. Set 0 to disable
py.test -s -v selenium  # autodiscover and run the tests

