build:
	python build.py -t chrome build -k dummy-chromium.pem $1
todo:
	grep -rn 'TODO' *.js helpers lib models styles test/unit views templates
logging:
	grep -rn 'console.log' *.js helpers lib models styles test/unit views templates

.PHONY: build todo logging
