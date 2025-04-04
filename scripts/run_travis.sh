#!/usr/bin/env bash

toplevel=$(git rev-parse --show-toplevel)
testdir=${toplevel}/tests/selenium

run_lint() {
  if ! make -C "$toplevel" lint; then
    echo "Linting errors"
    exit 1
  fi
}

run_selenium() {
  # autodiscover and run the tests
  pytest --capture=no --verbose --durations=10 "$testdir"
}

if [ "$INFO" == "lint" ]; then
    echo "Running lint"
    run_lint
else
    case $BROWSER in
      *chrome*)
        echo "Running tests on Chrome"
        run_selenium
        ;;
      *firefox*)
        echo "Running tests on Firefox"
        run_selenium
        ;;
      *edge*)
        echo "Running tests on Edge"
        run_selenium
        ;;
      *)
        echo "Unknown BROWSER value: $BROWSER"
        exit 1
        ;;
    esac
fi
