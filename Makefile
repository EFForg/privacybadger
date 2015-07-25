build: zip crx
zip:
	scripts/makezip.sh 
crx:
	scripts/makecrx.sh 
todo:
	grep -rn 'TODO' src
logging:
	grep -rn 'console.log' src lib
upload:
	scp doc/sample_cookieblocklist.txt $$COOKIE_BLOCK_UPLOAD_PATH
	scp doc/sample_domain_exception_list.json $$DOMAIN_EXCEPTION_UPLOAD_PATH
	scp doc/dnt-policies-example.json $$DNT_POLICIES_UPLOAD_PATH
.PHONY: build todo logging zip crx
