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
	scripts/legacy-cookies.sh
	scp src/data/cookieblocklist.txt $$COOKIE_BLOCK_UPLOAD_PATH
	scp doc/sample_cookieblocklist_legacy.txt $$COOKIE_BLOCK_LEGACY_UPLOAD_PATH
	#scp data/dnt-policies-example.json $$DNT_POLICIES_UPLOAD_PATH
lint:
	./node_modules/.bin/eslint .
.PHONY: build travisbuild updatepsl zip crx todo logging lint
