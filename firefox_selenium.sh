#!/usr/bin/env bash
set -e
ffpath=/usr/bin/firefox-aurora

runwebext() {
    node_modules/web-ext/bin/web-ext run --firefox=$ffpath --pref marionette.defaultPrefs.enabled=true
}

coproc webextfd { runwebext; }

rungeckodriver () {
    geckodriver --connect-existing --marionette-port 2828
}
coproc geckodriverfd { rungeckodriver; }

python firefox_test.py
