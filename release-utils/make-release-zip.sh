#!/bin/bash

# We use the immutable filesystem attribute as a workaround for the fact that
# the build scripts are not currently idempotent.

# The fact that the package is marked immutable means that it has been built
# for release.

if ! lsattr "$PREPKG" | cut -f 1 -d" " | grep -q i ; then

  if [ -f "$PREPKG" ] ; then
    echo "$PREPKG" is not immutable, rebuilding it for release!
  else
    echo building "$PREPKG" for the first time...
  fi

  if ! release-utils/make-eff-zip.sh "$GITTAG" ; then
    echo "Failed to build target $GITTAG"
    exit 1
  fi

  if ! [ -f "$PREPKG" -a -f "$PREPKGCWS" ] ; then
    echo "Failed to find package $PREPKG after build"
    exit 1
  fi

  # Verification and testing of build goes here!

  echo Marking "$PREPKG" immutable...
  if ! sudo true ; then
    echo "Failed to sudo :("
    exit 1
  fi
  if ! sudo chattr +i "$PREPKG" "$PREPKGCWS"; then
    echo ""
    echo "WARNING: FAILED TO MARK $PREPKG or $PREPKGCWS IMMUTABLE."
    echo "DO NOT RERUN THIS SCRIPT AFTER SIGNING"
    echo ""
    read -p "(Press Enter to acknowledge)"
  fi
else
  echo "$PREPKG is immutable; good, not rebuilding it..."
fi
