lint:
	./node_modules/.bin/eslint .

updatepsl:
	scripts/updatepsl.sh

updateseed:
	scripts/updateseeddata.sh

apply_effdntlist:
	scripts/apply_effdntlist.py src/data/seed.json

updategoogle:
	scripts/updategoogle.sh

updatecnames:
	scripts/updatecnames.sh

todo:
	grep -rn 'TODO' src

upload:
	$(eval TMPFILE := $(shell mktemp))
	scp src/data/yellowlist.txt $$YELLOWLIST_UPLOAD_PATH
	scripts/generate-legacy-yellowlist.sh > $(TMPFILE) && scp $(TMPFILE) $$YELLOWLIST_LEGACY_UPLOAD_PATH && rm $(TMPFILE)
	scp src/data/dnt-policies.json $$DNT_POLICIES_UPLOAD_PATH

tx:
	tx pull -f
	scripts/fix_placeholders.py

runch:
	./node_modules/.bin/web-ext run --target chromium --start-url "chrome://extensions" -s src/

runff:
	./node_modules/.bin/web-ext run --start-url "about:debugging#/runtime/this-firefox" -s src/

runfn:
	./node_modules/.bin/web-ext run --start-url "about:debugging#/runtime/this-firefox" -s src/ -f nightly

.PHONY: lint updatepsl updateseed apply_effdntlist updategoogle updatecnames todo tx runch runff runfn
