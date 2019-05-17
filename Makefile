lint:
	./node_modules/.bin/eslint .

updatepsl:
	scripts/updatepsl.sh

updateseed:
	scripts/updateseeddata.sh

updategoogle:
	scripts/updategoogle.sh

todo:
	grep -rn 'TODO' src

upload:
	$(eval TMPFILE := $(shell mktemp))
	scp src/data/yellowlist.txt $$YELLOWLIST_UPLOAD_PATH
	scripts/generate-legacy-yellowlist.sh > $(TMPFILE) && scp $(TMPFILE) $$YELLOWLIST_LEGACY_UPLOAD_PATH && rm $(TMPFILE)
	#scp data/dnt-policies.json $$DNT_POLICIES_UPLOAD_PATH

tx:
	tx pull -f
	scripts/fix_placeholders.py

runff:
	./node_modules/.bin/web-ext run --start-url "about:debugging" -s src/

runfn:
	./node_modules/.bin/web-ext run --start-url "about:debugging" -s src/ -f /opt/firefox/nightly/firefox

.PHONY: lint updatepsl updateseed updategoogle todo tx runff runfn
