#!/usr/bin/env bash

toplevel=$(git rev-parse --show-toplevel)
testdir=${toplevel}/tests/selenium

function run_lint {
  if ! make -C "$toplevel" lint; then
    echo "Linting errors"
    exit 1
  fi
}

function run_selenium {
  # autodiscover and run the tests
  pytest --reruns 5 --reruns-delay 1 --only-rerun NoSuchWindowException --capture=no --verbose --durations=10 "$testdir"
}

if [ "$INFO" == "lint" ]; then
    echo "running lint tests"
    run_lint
else
    case $BROWSER in
      *chrome*)
        echo "running tests on chrome"
        run_selenium
        ;;
      *firefox*)
        echo "running tests on firefox"
        run_selenium
        ;;
      *)
        echo "bad INFO variable, got $INFO"
        exit 1
        ;;
    esac
fi
