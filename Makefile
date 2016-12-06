build: updatepsl zip crx
travisbuild: zip crx
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
xpi:
	# TODO when does "make xpi" get called? should probably use same zip flags (exclude list, ...) as "make zip"
	zip -r privacybadger.xpi *
upload:
	scripts/legacy-cookies.sh
	scp doc/sample_cookieblocklist.txt $$COOKIE_BLOCK_UPLOAD_PATH
	scp doc/sample_cookieblocklist_legacy.txt $$COOKIE_BLOCK_LEGACY_UPLOAD_PATH
	#scp doc/dnt-policies-example.json $$DNT_POLICIES_UPLOAD_PATH
lint:
	./node_modules/.bin/eslint .
.PHONY: build travisbuild updatepsl zip crx todo logging lint
