#!/usr/bin/env bash

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

GOOGLE_DOMAINS_URL=https://www.google.com/supported_domains
MANIFEST_PATH=src/manifest.json
TEMPFILE=$(mktemp)

trap 'rm $TEMPFILE' EXIT

echo "fetching Google Search domains ..."
if wget -q -T 30 -O "$TEMPFILE" -- $GOOGLE_DOMAINS_URL && [ -s "$TEMPFILE" ]; then
	./scripts/updategoogle.py "$TEMPFILE" "$MANIFEST_PATH"
	if cmp -s "$TEMPFILE" $MANIFEST_PATH; then
		echo "    no Google Search domain updates"
	else
		cp "$TEMPFILE" $MANIFEST_PATH
		echo "    updated Google Search domains in $MANIFEST_PATH"
		echo "    please verify, update Google's MDFP list, and commit both!"
		exit 1
	fi
else
	echo "    failed to fetch $GOOGLE_DOMAINS_URL"
	echo "    aborting build!"
	exit 1
fi
