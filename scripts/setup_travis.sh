#!/usr/bin/env bash

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

toplevel=$(git rev-parse --show-toplevel)

function setup_firefox {
    # Install the latest version of geckodriver
    version=$(curl -sI https://github.com/mozilla/geckodriver/releases/latest | grep -i "^Location: " | sed 's/.*\///' | tr -d '\r')

    # check that we got something
    if [ -z "$version" ]; then
      echo "Failed to determine the latest geckodriver version!"
      exit 1
    fi

    # Geckodriver distribution is MacOS or Linux specific
    os="$(uname -s)"
    if [[ $os == "Darwin" ]]; then
      os_dist="macos.tar.gz"
    else
      os_dist="linux64.tar.gz"
    fi

    echo "Setting up geckodriver version $version ..."
    url="https://github.com/mozilla/geckodriver/releases/download/${version}/geckodriver-${version}-${os_dist}"
    wget -q -O /tmp/geckodriver.tar.gz "$url"
    sudo tar -xvf /tmp/geckodriver.tar.gz -C /usr/local/bin/
    sudo chmod a+x /usr/local/bin/geckodriver

    # check that geckodriver is now present
    type geckodriver >/dev/null 2>&1 || {
      echo "Failed to install geckodriver!"
      exit 1
    }
}

function browser_setup {
  # install python stuff
  pip install -r "$toplevel"/tests/requirements.txt
}

function setup_lint {
  # "--production" to skip installing devDependencies modules
  npm ci --production || exit 1
}

# check that the desired browser is present as it might fail to install
# for example: https://travis-ci.org/EFForg/privacybadger/jobs/362381214
function check_browser {
  type "$BROWSER" >/dev/null 2>&1 || {
    echo "$BROWSER seems to be missing!"
    exit 1
  }

  # print the version
  echo "Found $("$BROWSER" --version)"
}

case $INFO in
  *chrome*)
    check_browser
    "$toplevel"/scripts/chromedriver.sh "$BROWSER"
    browser_setup
    ;;
  *firefox*) # Install the latest version of geckodriver
    check_browser
    setup_firefox
    browser_setup
    ;;
  *lint*)
    setup_lint
    ;;
  *)
    echo "bad INFO variable, got $INFO"
    exit 1
    ;;
esac
