#!/usr/bin/env bash
set -e
ffpath=/usr/bin/firefox-aurora

../node_modules/web-ext/bin/web-ext run --source-dir="../" --firefox=$ffpath --pref marionette.defaultPrefs.enabled=true &
ext_PID=$!

geckodriver --connect-existing --marionette-port 2828 &
gecko_PID=$!

cleanstuff () {
    kill $gecko_PID
    kill $ext_PID
}

trap cleanstuff EXIT
wait
