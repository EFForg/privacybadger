#!/usr/bin/env bash
set -e

# web-ext uses these to launch and install the browser
export WEB_EXT_SOURCE_DIR=`dirname $PWD`
export WEB_EXT_PREF="marionette.defaultPrefs.enabled=true"
export WEB_EXT_FIREFOX="/usr/bin/firefox"

../node_modules/web-ext/bin/web-ext run &
ext_PID=$!
sleep 0.5

geckodriver --connect-existing --marionette-port 2828 &
gecko_PID=$!

cleanstuff () {
    kill $gecko_PID
    kill $ext_PID
}

trap cleanstuff EXIT
wait
