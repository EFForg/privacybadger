build: updatepsl updateseed zip crx

travisbuild: zip crx
	ls -1tr *.crx | tail -n 1

updatepsl:
	scripts/updatepsl.sh

updateseed:
	scripts/updateseeddata.sh

zip:
	scripts/makezip.sh 

crx:
	scripts/makecrx.sh 

todo:
	grep -rn 'TODO' src

logging:
	grep -rn 'console.log' src lib

upload:
	$(eval TMPFILE := $(shell mktemp))
	scp src/data/yellowlist.txt $$YELLOWLIST_UPLOAD_PATH
	scripts/generate-legacy-yellowlist.sh > $(TMPFILE) && scp $(TMPFILE) $$YELLOWLIST_LEGACY_UPLOAD_PATH && rm $(TMPFILE)
	#scp data/dnt-policies.json $$DNT_POLICIES_UPLOAD_PATH

lint:
	./node_modules/.bin/eslint .

tx:
	tx pull -f
	scripts/fix_placeholders.py

runff:
	./node_modules/.bin/web-ext run --start-url "about:debugging" -s src/

runfn:
	./node_modules/.bin/web-ext run --start-url "about:debugging" -s src/ -f /opt/firefox/nightly/firefox

.PHONY: build travisbuild updatepsl updateseed zip crx todo logging lint tx runff runfn
