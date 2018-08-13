build: updatepsl zip crx

travisbuild: zip crx
	ls -1tr *.crx | tail -n 1

updatepsl:
	scripts/updatepsl.sh

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

.PHONY: build travisbuild updatepsl zip crx todo logging lint tx
