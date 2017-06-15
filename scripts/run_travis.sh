#!/bin/bash
toplevel=$(git rev-parse --show-toplevel)
testdir=${toplevel}/tests/selenium

function run_lint {
  pushd $toplevel
  make lint
  if [ $? != 0 ]; then
    echo "Linting errors"
    exit 1
  fi
  popd
}

function run_selenium {
  py.test --exitfirst --capture=no --verbose --durations=10 ${testdir} # autodiscover and run the tests
}

function set_info {
  if [ -n "$INFO" ]; then
    case $BROWSER in
      *chrome*)
          echo "setting info=chrome"
        export INFO=chrome
        ;;
      *firefox*)
          echo "setting info=firefox"
        export INFO=firefox
        ;;
    esac
  fi
}

set_info
case $INFO in
  *chrome*)
    echo "running tests on chrome"
    run_selenium
    ;;
  *firefox*)
    echo "running tests on firefox"
    run_selenium
    ;;
  *lint*)
    echo "running lint tests"
    run_lint
    ;;
  *)
    echo "bad INFO variable, got $INFO"
    exit 1
    ;;
esac
