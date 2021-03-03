#!/usr/bin/env bash
# Update the pre-trained "seed" tracker list

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

SEED_PATH=src/data/seed.json
SEED_URL=https://raw.githubusercontent.com/EFForg/badger-sett/master/results.json
TEMPFILE=$(mktemp)

trap 'rm $TEMPFILE' EXIT

echo "fetching seed tracker lists..."
if wget -q -T 30 -O "$TEMPFILE" -- $SEED_URL && [ -s "$TEMPFILE" ]; then
  if ! python scripts/verify_json.py "$TEMPFILE"; then
    echo "    new seed data is not formatted correctly"
    echo "    aborting build!"
    exit 1
  fi

  if cmp -s "$TEMPFILE" $SEED_PATH; then
    echo "    no seed data updates"
  else
    cp "$TEMPFILE" $SEED_PATH
    echo "    updated seed data at $SEED_PATH"
    echo "    please verify and commit!"
    exit 1
  fi
else
  echo "    failed to fetch seed data from $SEED_URL"
  echo "    aborting build!"
  exit 1
fi
