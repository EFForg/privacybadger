build: zip crx
zip:
	scripts/makezip.sh 
crx:
	scripts/makecrx.sh 
todo:
	grep -rn 'TODO' *.js lib
logging:
	grep -rn 'console.log' *.js lib

.PHONY: build todo logging zip crx
