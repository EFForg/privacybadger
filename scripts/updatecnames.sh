#!/usr/bin/env bash
# Updates CNAME domains JSON

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

CNAME_LIST_PATH=src/data/cname_domains.json
CNAME_LIST_URL=https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/combined_disguised_trackers.json
TEMPFILE=$(mktemp)

trap 'rm $TEMPFILE' EXIT

echo "fetching CNAME domain list ..."
if wget -q -T 30 -O "$TEMPFILE" -- $CNAME_LIST_URL && [ -s "$TEMPFILE" ]; then
  # validation
  if ! python3 -m json.tool "$TEMPFILE" >/dev/null; then
    echo "    new CNAME domain list is not formatted correctly"
    echo "    aborting build!"
    exit 1
  fi

  if cmp -s "$TEMPFILE" $CNAME_LIST_PATH; then
    echo "    no CNAME domain list updates"
  else
    cp "$TEMPFILE" $CNAME_LIST_PATH
    echo "    updated CNAME domain list at $CNAME_LIST_PATH"
    echo "    please verify and commit!"
    exit 1
  fi
else
  echo "    failed to fetch CNAME domains from $CNAME_LIST_URL"
  echo "    aborting build!"
  exit 1
fi
