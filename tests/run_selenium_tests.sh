#!/bin/bash
command -v chromedriver >/dev/null 2>&1 || { echo >&2 "Cannot find chromedriver in PATH. Aborting."; exit 1; }

pushd .
cd ..
make lint
if [ $? != 0 ]; then
  echo "Linting errors"
  exit 1
fi
make travisbuild # pack the extension
ext_path=`ls -1tr $PWD/*.crx | tail -n 1` # get the last modified crx
popd

# trap 'rm -rf PBTESTENV' EXIT  # Clean virtualenv dir on exit
# virtualenv PBTESTENV
# source PBTESTENV/bin/activate
pip install -r sel_requirements.txt

# TODO: take command line arguments to set the following environment variables
export PB_EXT_PATH=$ext_path  # extension on this path will be used in the tests
# if this var is empty, extension base dir will be searched for the last modified .crx.
echo "Chrome path: "$BROWSER_BIN
# export BROWSER_BIN="/path/to/chrome"   # Optional.
# If BROWSER_BIN is empty, Selenium will pick the default binary for Chrome.
# To run tests with Chromium (instead of Google Chrome) export BROWSER_BIN="/usr/bin/chromium-browser"
export ENABLE_XVFB=1    # run the tests headless using Xvfb. Set 0 to disable
# for i in {1..20}; do echo "Run "$i; py.test -s -v --durations=10 selenium; done  # autodiscover and run the tests
py.test -s -v --durations=10 selenium  # autodiscover and run the tests
