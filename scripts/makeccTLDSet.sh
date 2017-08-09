#!/usr/bin/env bash
html=$(wget -qO- http://www.wipo.int/amc/en/domains/cctld_db/)
text=$(echo "$html" | grep option | sed -n 's/.*(\.\([A-Z][A-Z]\)).*/\1/p' | tr '[:upper:]' '[:lower:]')
arrInner=$(echo "$text" | sed 's/\(.*\)/"\1",/')
echo "let ccTLDs = new Set([" > ccTLDSet.js
echo "$arrInner" >> ccTLDSet.js
echo "]);" >> ccTLDSet.js
