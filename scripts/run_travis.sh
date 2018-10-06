#!/bin/bash

toplevel=$(git rev-parse --show-toplevel)
testdir=${toplevel}/tests/selenium

function run_lint {
  make -C "$toplevel" lint
  if [ $? != 0 ]; then
    echo "Linting errors"
    exit 1
  fi
}

function run_selenium {
  py.test --capture=no --verbose --durations=10 "$testdir" # autodiscover and run the tests
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
