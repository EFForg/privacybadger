#!/usr/bin/env bash
set -e
ffpath=/usr/bin/firefox-aurora

runwebext() {
    node_modules/web-ext/bin/web-ext run --firefox=$ffpath --pref marionette.defaultPrefs.enabled=true
}

coproc webextfd { runwebext; }

exec 3>&${webextfd[0]}

while read -u 3 -r line
do
    if echo $line | grep "Firefox with profile"
    then
        profpath=$(echo $line | sed -e 's/.*profile at \(.*$\)/\1/')
        break
    fi
done

rungeckodriver () {
    geckodriver --connect-existing --marionette-port 2828
}
coproc geckodriverfd { rungeckodriver; }

python firefox_test.py
