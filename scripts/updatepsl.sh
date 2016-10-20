#!/usr/bin/env bash

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

PSL_PATH=lib/publicSuffixList.js
PSL_URL=https://publicsuffix.org/list/public_suffix_list.dat
TEMPFILE=$(mktemp)

trap 'rm $TEMPFILE' EXIT

echo "fetching Public Suffix List ..."
if wget -q -T 30 -O "$TEMPFILE" -- $PSL_URL; then
	if [ -s "$TEMPFILE" ]; then
		python scripts/convertpsl.py "$TEMPFILE"
		if cmp -s "$TEMPFILE" $PSL_PATH; then
			echo "    no PSL updates"
		else
			echo "    updated PSL at $PSL_PATH"
			cp "$TEMPFILE" $PSL_PATH
			echo "    please verify and commit!"
			exit 1
		fi
	fi
fi
