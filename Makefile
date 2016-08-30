build: zip crx
zip:
	scripts/makezip.sh 
crx:
	scripts/makecrx.sh 
todo:
	grep -rn 'TODO' src
logging:
	grep -rn 'console.log' src lib
xpi:
	zip -r privacybadger.xpi *
upload:
	scp doc/sample_cookieblocklist.txt $$COOKIE_BLOCK_UPLOAD_PATH
	scp doc/sample_cookieblocklist_legacy.txt $$COOKIE_BLOCK_LEGACY_UPLOAD_PATH
	scp doc/sample_domain_exception_list.json $$DOMAIN_EXCEPTION_UPLOAD_PATH
	scp doc/dnt-policies-example.json $$DNT_POLICIES_UPLOAD_PATH
lint:
	./node_modules/.bin/eslint .
.PHONY: build todo logging zip crx lint
