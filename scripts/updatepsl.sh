#!/usr/bin/env bash
# Update the Public Suffix List (psl)

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

PSL_PATH=src/lib/publicSuffixList.js
PSL_URL=https://publicsuffix.org/list/public_suffix_list.dat
TEMPFILE=$(mktemp)

trap 'rm $TEMPFILE' EXIT

echo "fetching Public Suffix List ..."
if wget -q -T 30 -O "$TEMPFILE" -- $PSL_URL && [ -s "$TEMPFILE" ]; then
	./scripts/convertpsl.cjs "$TEMPFILE"
	if cmp -s "$TEMPFILE" $PSL_PATH; then
		echo "    no PSL updates"
	else
		cp "$TEMPFILE" $PSL_PATH
		echo "    updated PSL at $PSL_PATH"
		echo "    please verify and commit!"
		exit 1
	fi
else
	echo "    failed to fetch PSL from $PSL_URL"
	echo "    aborting build!"
	exit 1
fi
