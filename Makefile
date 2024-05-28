# https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux
crx:
	$(eval TMPFILE := $(shell mktemp))
	cp src/manifest.json $(TMPFILE)
	./scripts/patch_manifest.py src/manifest.json set update_url http://localhost:9999/updates.xml
	google-chrome --pack-extension=./src --pack-extension-key=./release-utils/dummy-chromium.pem
	mv src.crx release-utils/privacy-badger.crx
	mv $(TMPFILE) src/manifest.json

lint:
	./node_modules/.bin/eslint .

updatepsl:
	scripts/updatepsl.sh

genstaticrules:
	scripts/genstaticrules.js

updateseed:
	scripts/updateseeddata.sh

apply_effdntlist:
	scripts/apply_effdntlist.py src/data/seed.json

updategoogle:
	scripts/updategoogle.sh

updatecnames:
	scripts/updatecnames.sh

upload:
	$(eval TMPFILE := $(shell mktemp))
	scp src/data/yellowlist.txt $$YELLOWLIST_UPLOAD_PATH
	scripts/generate-legacy-yellowlist.sh > $(TMPFILE) && scp $(TMPFILE) $$YELLOWLIST_LEGACY_UPLOAD_PATH && rm $(TMPFILE)
	scp src/data/dnt-policies.json $$DNT_POLICIES_UPLOAD_PATH

# get the Transifex CLI client from https://github.com/transifex/cli/releases/latest
tx:
	tx pull -f
	scripts/fix_placeholders.py

runch:
	./node_modules/.bin/web-ext run --target chromium --start-url "chrome://extensions" -s src/

runfa:
	./node_modules/.bin/web-ext run -s src/ --target firefox-android --adb-bin $$ADB_BIN --android-device $$ANDROID_DEVICE_ID --firefox-apk org.mozilla.firefox --verbose

runff:
	./node_modules/.bin/web-ext run --devtools --start-url "about:debugging#/runtime/this-firefox" -s src/

runfn:
	./node_modules/.bin/web-ext run --devtools --start-url "about:debugging#/runtime/this-firefox" -s src/ -f nightly

test:
	BROWSER=chrome ENABLE_XVFB=1 pytest -s tests/

.PHONY: crx lint updatepsl genstaticrules updateseed apply_effdntlist updategoogle updatecnames tx runch runfa runff runfn test
