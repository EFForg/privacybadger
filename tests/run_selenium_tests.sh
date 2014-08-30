#!/bin/bash
if [ -x /usr/local/bin/chromedriver ]; then
	echo "Will use ChromeDriver at /usr/local/bin/chromedriver"
else
	echo "Could not find ChromeDriver in the PATH. Aborting!"
	exit 1
fi

pushd .
cd ..
make  # pack the extension
ext_path=`ls -1tr $PWD/*.crx | tail -n 1` # get the last modified crx
popd

trap 'rm -rf PBTESTENV' EXIT
virtualenv PBTESTENV
source PBTESTENV/bin/activate
pip install -r sel_requirements.txt
export PB_EXT_PATH=$ext_path  # if not empty, extension at this path will be used in the tests
export BROWSER="Chrome" # can be Chrome, Chromium, Firefox
export BROWSER_BIN=""   # path to the browser binary. Can be empty. Selenium will pick the default binary for the selected browser
export ENABLE_XVFB=1    # run the tests headless using Xvfb. Set 0 to disable

py.test -s # autodiscover and run the tests

